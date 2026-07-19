import { basename, dirname, extname, join, relative } from "node:path";
import { ALWAYS_APPLICABLE } from "./constants.js";
import { assertSafeRelative, canonicalDirectory, readTextIfPresent, resolveInside, runFile, toPosix, walkFiles } from "./utils.js";
const SOURCE_EXTENSIONS = [".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"];
const MAX_IMPACT_COMPARISONS = 2_000_000;
const EXCLUDED = new Set([
    ".git",
    ".forge",
    ".fullstack-forge",
    ".next",
    ".nuxt",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "vendor"
]);
export async function analyzeChangedScope(rootInput, profile, requestedBase) {
    const selectedRoot = await canonicalDirectory(rootInput);
    const repositoryRoot = await resolveRepositoryRoot(selectedRoot);
    if (repositoryRoot !== selectedRoot) {
        throw new Error(`Changed scope requires the repository root. Selected ${selectedRoot}; Git resolved ${repositoryRoot}.`);
    }
    const baseRef = requestedBase === undefined
        ? await determineDefaultBase(repositoryRoot)
        : validateBase(requestedBase);
    const baseCommit = await resolveCommit(repositoryRoot, baseRef);
    const mergeBase = (await git(repositoryRoot, ["merge-base", baseCommit, "HEAD"])).trim();
    if (!/^[a-f0-9]{40,64}$/u.test(mergeBase))
        throw new Error(`Could not determine a merge base for '${baseRef}'.`);
    const sets = await Promise.all([
        git(repositoryRoot, ["diff", "--name-status", "-z", "--find-renames", `${mergeBase}...HEAD`]),
        git(repositoryRoot, ["diff", "--cached", "--name-status", "-z", "--find-renames"]),
        git(repositoryRoot, ["diff", "--name-status", "-z", "--find-renames"]),
        git(repositoryRoot, ["ls-files", "--others", "--exclude-standard", "-z"])
    ]);
    const changed = new Map();
    addNameStatus(changed, sets[0], "committed");
    addNameStatus(changed, sets[1], "staged");
    addNameStatus(changed, sets[2], "unstaged");
    for (const path of splitNul(sets[3]))
        addChanged(changed, safeGitPath(path), "untracked", "untracked");
    const sourceFiles = await collectRepositoryFiles(repositoryRoot);
    const sourceSet = new Set(sourceFiles);
    const reasons = new Map();
    for (const item of changed.values()) {
        if (item.status === "deleted")
            addReason(reasons, item.path, `deleted (${item.sources.join(", ")})`);
        else if (sourceSet.has(item.path))
            addReason(reasons, item.path, `changed (${item.sources.join(", ")})`);
        if (item.previous_path !== undefined)
            addReason(reasons, item.previous_path, `rename source for ${item.path}`);
    }
    const graphs = await buildImportGraphs(repositoryRoot, sourceFiles);
    expandGraph(reasons, graphs.forward, graphs.reverse);
    await expandWorkspaceDependencies(repositoryRoot, sourceFiles, changed, reasons);
    expandSchemaAndMigrationImpact(sourceFiles, changed, reasons);
    expandPolicyAndRouteImpact(sourceFiles, changed, reasons);
    expandTestsAndGeneratedImpact(sourceFiles, reasons);
    const modules = moduleImpact(changed, reasons);
    assertImpactBudget(profile.applications.length, reasons.size, "application mapping");
    const affectedApplications = profile.applications.flatMap((application) => {
        const appRoot = normalizeRoot(application.root);
        const matching = [...reasons.entries()].filter(([path]) => under(path, appRoot));
        return matching.length === 0
            ? []
            : [
                {
                    name: application.name,
                    root: appRoot,
                    reasons: [...new Set(matching.flatMap(([, values]) => [...values]))].slice(0, 12)
                }
            ];
    });
    const affectedKeys = new Set(affectedApplications.map((application) => `${application.name}\u0000${application.root}`));
    const excludedApplications = profile.applications.flatMap((application) => {
        const appRoot = normalizeRoot(application.root);
        return affectedKeys.has(`${application.name}\u0000${appRoot}`)
            ? []
            : [
                {
                    name: application.name,
                    root: appRoot,
                    reason: "No changed file or dependency expansion reached this application."
                }
            ];
    });
    const includedFiles = [...reasons.entries()]
        .map(([path, values]) => ({ path, reasons: [...values].sort() }))
        .sort((a, b) => a.path.localeCompare(b.path));
    return {
        files: new Set(includedFiles.map((item) => item.path)),
        modules,
        evidence: {
            repository_root: repositoryRoot,
            base_ref: baseRef,
            base_commit: baseCommit,
            merge_base: mergeBase,
            changed_files: [...changed.values()].sort((a, b) => a.path.localeCompare(b.path)),
            included_files: includedFiles,
            excluded_applications: excludedApplications,
            affected_applications: affectedApplications,
            affected_modules: [...modules]
                .sort()
                .map((section) => ({ section, reasons: moduleReasons(section, changed, reasons) }))
        }
    };
}
async function resolveRepositoryRoot(selectedRoot) {
    const output = (await git(selectedRoot, ["rev-parse", "--show-toplevel"])).trim();
    return canonicalDirectory(output);
}
function validateBase(value) {
    if (value.length === 0 ||
        value.length > 240 ||
        value.startsWith("-") ||
        value.includes("\0") ||
        value.includes("..") ||
        !/^[A-Za-z0-9_./@{}~^:+-]+$/u.test(value)) {
        throw new Error(`Unsafe Git base reference '${value}'.`);
    }
    return value;
}
/**
 * Base precedence: explicit --base, then the current branch upstream, then origin/HEAD,
 * origin/main, origin/master, then local main and master.
 *
 * HEAD is deliberately never used as a fallback: `merge-base HEAD HEAD` is HEAD itself, which
 * would silently hide every committed change on the branch and imply full coverage. When no
 * meaningful base exists the caller receives a structured BLOCKED error instead.
 */
async function determineDefaultBase(root) {
    const upstream = await gitOptional(root, [
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        "@{upstream}"
    ]);
    if (upstream !== undefined && upstream.trim().length > 0)
        return validateBase(upstream.trim());
    const remoteHead = await gitOptional(root, [
        "symbolic-ref",
        "--quiet",
        "refs/remotes/origin/HEAD"
    ]);
    if (remoteHead !== undefined)
        return validateBase(remoteHead.trim().replace(/^refs\/remotes\//u, ""));
    for (const candidate of ["origin/main", "origin/master"]) {
        const exists = await gitOptional(root, ["show-ref", "--verify", `refs/remotes/${candidate}`]);
        if (exists !== undefined)
            return candidate;
    }
    for (const candidate of ["main", "master"]) {
        const exists = await gitOptional(root, ["show-ref", "--verify", `refs/heads/${candidate}`]);
        if (exists !== undefined)
            return candidate;
    }
    throw new Error("BLOCKED: no comparison base could be resolved. Tried the branch upstream, origin/HEAD, origin/main, origin/master, and local main and master. Pass an explicit --base.");
}
async function resolveCommit(root, base) {
    const output = await gitOptional(root, ["rev-parse", "--verify", `${base}^{commit}`]);
    if (output === undefined || !/^[a-f0-9]{40,64}\s*$/u.test(output))
        throw new Error(`Git base reference '${base}' does not resolve to a commit.`);
    return output.trim();
}
async function git(root, args) {
    const result = await runFile("git", args, root, 60_000);
    if (result.exitCode !== 0)
        throw new Error(`git ${args[0] ?? "command"} failed: ${compactError(result.stderr || result.stdout)}`);
    return result.stdout;
}
async function gitOptional(root, args) {
    const result = await runFile("git", args, root, 60_000);
    return result.exitCode === 0 ? result.stdout : undefined;
}
function addNameStatus(target, output, source) {
    const tokens = splitNul(output);
    for (let index = 0; index < tokens.length;) {
        const code = tokens[index++] ?? "";
        if (/^[RC]/u.test(code)) {
            const previous = safeGitPath(tokens[index++] ?? "");
            const path = safeGitPath(tokens[index++] ?? "");
            addChanged(target, path, "renamed", source, previous);
            continue;
        }
        const path = safeGitPath(tokens[index++] ?? "");
        const status = code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified";
        addChanged(target, path, status, source);
    }
}
function addChanged(target, path, status, source, previousPath) {
    const current = target.get(path);
    if (current === undefined) {
        target.set(path, {
            path,
            ...(previousPath === undefined ? {} : { previous_path: previousPath }),
            status,
            sources: [source]
        });
    }
    else {
        if (!current.sources.includes(source))
            current.sources.push(source);
        if (current.status !== "renamed" && status === "renamed")
            current.status = status;
    }
}
function safeGitPath(path) {
    const normalized = path.replaceAll("\\", "/");
    assertSafeRelative(normalized);
    return normalized;
}
function splitNul(value) {
    return value.split("\0").filter((token) => token.length > 0);
}
async function collectRepositoryFiles(root) {
    const output = [];
    for (const absolute of await walkFiles(root, {
        exclude: EXCLUDED,
        maxBytes: 2 * 1024 * 1024,
        maxFiles: 20_000,
        maxTotalBytes: 256 * 1024 * 1024,
        maxDepth: 64
    })) {
        const path = toPosix(relative(root, absolute));
        assertSafeRelative(path);
        resolveInside(root, path);
        output.push(path);
    }
    return output.sort();
}
async function buildImportGraphs(root, files) {
    const fileSet = new Set(files);
    const forward = new Map();
    const reverse = new Map();
    const pattern = /(?:\b(?:import|export)\b[^"'`]*?\bfrom\s*|\brequire\s*\(|\bimport\s*\()\s*["'`]([^"'`]+)["'`]/gu;
    for (const path of files.filter((candidate) => SOURCE_EXTENSIONS.includes(extname(candidate).toLowerCase()))) {
        const content = await readTextIfPresent(resolveInside(root, path));
        if (content === undefined)
            continue;
        pattern.lastIndex = 0;
        for (const match of content.matchAll(pattern)) {
            const request = match[1];
            if (request === undefined || !request.startsWith("."))
                continue;
            const resolved = resolveImport(path, request, fileSet);
            if (resolved === undefined)
                continue;
            mapAdd(forward, path, resolved);
            mapAdd(reverse, resolved, path);
        }
    }
    return { forward, reverse };
}
function resolveImport(importer, request, files) {
    const base = toPosix(join(dirname(importer), request));
    const candidates = [
        base,
        ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
        ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`)
    ].map((path) => path.replace(/^\.\//u, ""));
    return candidates.find((candidate) => files.has(candidate));
}
function expandGraph(reasons, forward, reverse) {
    const queue = [...reasons.keys()];
    const visited = new Set(queue);
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined)
            continue;
        for (const dependency of forward.get(current) ?? []) {
            addReason(reasons, dependency, `imported by affected file ${current}`);
            if (!visited.has(dependency)) {
                visited.add(dependency);
                queue.push(dependency);
            }
        }
        for (const importer of reverse.get(current) ?? []) {
            addReason(reasons, importer, `depends on affected file ${current}`);
            if (!visited.has(importer)) {
                visited.add(importer);
                queue.push(importer);
            }
        }
    }
}
async function expandWorkspaceDependencies(root, files, changed, reasons) {
    const manifests = [];
    for (const path of files.filter((candidate) => basename(candidate) === "package.json")) {
        const text = await readTextIfPresent(resolveInside(root, path));
        if (text === undefined)
            continue;
        try {
            const value = JSON.parse(text);
            const name = typeof value.name === "string" ? value.name : dirname(path);
            const dependencies = new Set();
            for (const group of ["dependencies", "devDependencies", "peerDependencies"]) {
                const entries = value[group];
                if (isRecord(entries))
                    for (const dependency of Object.keys(entries))
                        dependencies.add(dependency);
            }
            manifests.push({ path, root: normalizeRoot(dirname(path)), name, dependencies });
        }
        catch {
            // Invalid manifests are handled by dependency inspection.
        }
    }
    assertImpactBudget(manifests.length, changed.size, "workspace change mapping");
    const affectedNames = new Set(manifests
        .filter((manifest) => [...changed.keys()].some((path) => under(path, manifest.root)))
        .map((manifest) => manifest.name));
    for (const manifest of manifests) {
        const hit = [...affectedNames].find((name) => manifest.dependencies.has(name));
        if (hit === undefined)
            continue;
        for (const path of files.filter((candidate) => under(candidate, manifest.root)))
            addReason(reasons, path, `workspace ${manifest.name} depends on changed package ${hit}`);
    }
}
function expandSchemaAndMigrationImpact(files, changed, reasons) {
    const schemas = [...changed.keys()].filter((path) => /(?:schema|prisma|models?|migrations?)/iu.test(path));
    assertImpactBudget(schemas.length, files.length, "schema impact expansion");
    for (const schema of schemas) {
        const workspace = nearestWorkspace(schema, files);
        for (const path of files) {
            if (!under(path, workspace))
                continue;
            if (/(?:migrations?|queries?|repositories?|database|__tests__|tests?|\.test\.|\.spec\.)/iu.test(path))
                addReason(reasons, path, `schema or migration impact from ${schema}`);
        }
    }
}
function expandPolicyAndRouteImpact(files, changed, reasons) {
    const policies = [...changed.keys()].filter((path) => /(?:auth(?:orization)?|tenant|permission|policy|roles?)/iu.test(path));
    assertImpactBudget(policies.length, files.length, "policy impact expansion");
    for (const policy of policies) {
        const workspace = nearestWorkspace(policy, files);
        for (const path of files) {
            if (under(path, workspace) &&
                /(?:routes?|controllers?|handlers?|api|__tests__|tests?)/iu.test(path))
                addReason(reasons, path, `shared authorization or tenant policy changed at ${policy}`);
        }
    }
}
function expandTestsAndGeneratedImpact(files, reasons) {
    const current = [...reasons.keys()];
    assertImpactBudget(current.length, files.length, "test and generated impact expansion");
    for (const path of current) {
        const stem = basename(path)
            .replace(/\.(?:test|spec)?\.[^.]+$/u, "")
            .replace(/\.[^.]+$/u, "");
        for (const candidate of files) {
            if (candidate === path)
                continue;
            if (/(?:__tests__|tests?|generated|dist|build)/iu.test(candidate) &&
                basename(candidate).includes(stem))
                addReason(reasons, candidate, `test or generated counterpart of ${path}`);
        }
    }
}
function moduleImpact(changed, reasons) {
    const modules = new Set([...ALWAYS_APPLICABLE].filter((section) => !["discover", "all", "ship"].includes(section)));
    const corpus = [...new Set([...changed.keys(), ...reasons.keys()])].join("\n").toLowerCase();
    const mappings = [
        ["accessibility", /a11y|accessib|\.tsx|\.jsx/u],
        ["api", /route|controller|handler|api/u],
        ["auth", /auth|login|session|oauth/u],
        ["authorization", /auth|authoriz|permission|policy|role/u],
        ["tenancy", /tenant|organization/u],
        ["uploads", /upload|multipart|storage/u],
        ["database", /schema|migration|prisma|database/u],
        ["queries", /query|repository|prisma|database/u],
        ["cache", /cache|redis/u],
        ["deployment", /deploy|docker|vercel|netlify|workflow/u],
        ["infrastructure", /terraform|pulumi|serverless|kubernetes/u],
        ["ai", /ai|model|openai|anthropic/u],
        ["payments", /payment|stripe|invoice|checkout/u],
        ["integrations", /webhook|integration/u]
    ];
    for (const [section, pattern] of mappings)
        if (pattern.test(corpus))
            modules.add(section);
    return modules;
}
function moduleReasons(section, changed, reasons) {
    if (ALWAYS_APPLICABLE.has(section))
        return ["required always-applicable module for changed scope"];
    const relevant = [...new Set([...changed.keys(), ...reasons.keys()])]
        .filter((path) => path.toLowerCase().includes(section.replace("authorization", "auth")))
        .slice(0, 8);
    return relevant.length > 0
        ? relevant.map((path) => `affected path ${path}`)
        : ["capability impact mapping"];
}
function nearestWorkspace(path, files) {
    const manifests = files
        .filter((candidate) => basename(candidate) === "package.json")
        .map((candidate) => normalizeRoot(dirname(candidate)))
        .filter((root) => under(path, root))
        .sort((a, b) => b.length - a.length);
    return manifests[0] ?? ".";
}
function normalizeRoot(value) {
    if (value === undefined || value === "" || value === ".")
        return ".";
    return value.replaceAll("\\", "/").replace(/^\.\//u, "").replace(/\/$/u, "");
}
function under(path, root) {
    return root === "." || path === root || path.startsWith(`${root}/`);
}
function addReason(reasons, path, reason) {
    const current = reasons.get(path) ?? new Set();
    current.add(reason);
    reasons.set(path, current);
}
function mapAdd(map, key, value) {
    const current = map.get(key) ?? new Set();
    current.add(value);
    map.set(key, current);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compactError(value) {
    return value.replace(/\s+/gu, " ").trim().slice(0, 400) || "no diagnostic output";
}
function assertImpactBudget(left, right, label) {
    if (left * right > MAX_IMPACT_COMPARISONS)
        throw new Error(`Changed-scope ${label} exceeded the ${MAX_IMPACT_COMPARISONS}-comparison budget.`);
}
//# sourceMappingURL=scope.js.map