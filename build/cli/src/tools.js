import { access, lstat, readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { MODULE_SLUGS, PACKAGE_ROOT, TOOL_NAMES } from "./constants.js";
import { detectProjectCommands, discoverProject, writeProjectArtifacts } from "./discovery.js";
import { assertAgentFindings, assertFindings, validateFinding } from "./finding.js";
import { bindAgentFindings, reconcileFindings } from "./agent-findings.js";
import { inspectWithTool } from "./inspectors.js";
import { decideCommandExecution, ledgerRecord } from "./offline-policy.js";
import { inspectRenderedUi } from "./rendered-ui.js";
import { createReport, readReport, writeReport } from "./report.js";
import { canonicalDirectory, resolveInside, runFile, sha256, toPosix, workingTreeRevision } from "./utils.js";
export const SOURCE_CHECKOUT_ONLY_TOOL_NAMES = [
    "sync-platform-assets",
    "check-platform-assets",
    "package-platforms",
    "smoke-install"
];
export async function runTool(nameInput, args, options) {
    if (!isToolName(nameInput))
        throw new Error(`Unknown tool '${nameInput}'. Run 'forge list' for valid tools.`);
    const root = await canonicalDirectory(options.cwd);
    if (nameInput === "detect-stack") {
        const profile = await discoverProject(root);
        return {
            value: {
                root: profile.root,
                generated_at: profile.generated_at,
                detections: profile.detections
            },
            exitCode: 0
        };
    }
    if (nameInput === "discover-project") {
        const profile = await discoverProject(root);
        const artifacts = await writeProjectArtifacts(profile, options.dryRun);
        return { value: { profile, artifacts, dry_run: options.dryRun }, exitCode: 0 };
    }
    if (nameInput === "detect-project-commands") {
        return { value: await detectProjectCommands(root), exitCode: 0 };
    }
    if (nameInput === "run-project-command") {
        const commandName = args[0];
        if (commandName === undefined)
            throw new Error("run-project-command requires a detected script name");
        const commands = await detectProjectCommands(root);
        const command = commands.find((candidate) => candidate.name === commandName);
        if (command === undefined)
            throw new Error(`'${commandName}' is not a detected project command`);
        const context = { offline: options.offline, forgeOwned: await isForgePackageRoot(root) };
        const decision = decideCommandExecution(command, context);
        if (!options.allowRun) {
            return {
                value: {
                    status: "BLOCKED",
                    reason: "Execution requires explicit --allow-run after reviewing the local script definition.",
                    command,
                    ledger: [ledgerRecord(command, decision, "NOT_RUN", options.offline)]
                },
                exitCode: 2
            };
        }
        if (!decision.permitted) {
            // A blocked command is never executed and never produces an execution record, so it can
            // never be promoted into typed PASS evidence downstream.
            return {
                value: {
                    status: "BLOCKED",
                    reason: decision.reason,
                    command,
                    ledger: [ledgerRecord(command, decision, "BLOCKED", options.offline)]
                },
                exitCode: 2
            };
        }
        const execution = await runFile(command.executable, command.args, root);
        return {
            value: {
                command,
                ...execution,
                ledger: [ledgerRecord(command, decision, "RAN", options.offline, execution.exitCode)]
            },
            exitCode: execution.exitCode
        };
    }
    if (nameInput === "inspect-rendered-ui") {
        return inspectRenderedUi(root, args, options, await workingTreeRevision(root));
    }
    if (isInspectionTool(nameInput)) {
        const inspection = await inspectWithTool(nameInput, root);
        return {
            value: inspection,
            exitCode: inspection.findings.some((finding) => finding.status === "FAIL") ? 1 : 0
        };
    }
    if (nameInput === "generate-report") {
        const profile = await loadOrDiscoverProfile(root);
        const findingPath = args[0] === undefined ? join(root, ".forge", "findings.json") : resolveInside(root, args[0]);
        const parsed = JSON.parse(await readFile(findingPath, "utf8"));
        const findings = extractFindings(parsed);
        assertFindings(findings);
        const report = createReport(root, profile, findings, "generated from findings input");
        const paths = options.dryRun
            ? []
            : await writeReport(report, options.output === undefined ? undefined : resolveInside(root, options.output));
        return {
            value: { report, paths, dry_run: options.dryRun },
            exitCode: findings.some((finding) => finding.status === "FAIL") ? 1 : 0
        };
    }
    if (nameInput === "ingest-agent-findings") {
        const input = args[0];
        if (input === undefined)
            throw new Error("ingest-agent-findings requires a JSON path under the project root");
        const parsed = JSON.parse(await readFile(resolveInside(root, input), "utf8"));
        const findings = extractFindings(parsed);
        assertAgentFindings(findings);
        const boundFindings = await bindAgentFindings(root, findings);
        const profile = await loadOrDiscoverProfile(root);
        let previous;
        try {
            previous = await readReport(root, join(root, ".forge", "report.json"));
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
        const report = createReport(root, previous?.profile ?? profile, reconcileFindings(previous?.findings ?? [], boundFindings), previous === undefined ? "agent findings" : `${previous.scope}; agent findings ingested`, previous?.execution ?? [], previous?.assumptions ?? [], previous?.residual_risk ?? [], previous?.scope_evidence, previous?.gate_evidence ?? [], previous?.analyzer_coverage ?? [], await workingTreeRevision(root), previous?.environment, previous === undefined
            ? {}
            : {
                tools: previous.tools,
                planned_checks: previous.planned_checks,
                runtime_evidence: previous.runtime_evidence,
                module_decisions: previous.module_decisions
            });
        const paths = options.dryRun ? [] : await writeReport(report);
        return {
            value: { report, paths, dry_run: options.dryRun },
            exitCode: boundFindings.some((finding) => finding.status === "FAIL") ? 1 : 0
        };
    }
    if (nameInput === "snapshot-evidence") {
        const input = args[0];
        if (input === undefined)
            throw new Error("snapshot-evidence requires a repository-relative source path");
        const line = args[1] === undefined ? undefined : Number.parseInt(args[1], 10);
        if (line !== undefined && (!Number.isInteger(line) || line < 1))
            throw new Error("snapshot-evidence line must be a positive integer");
        const content = await readFile(resolveInside(root, input), "utf8");
        const excerpt = line === undefined ? undefined : (content.split(/\r?\n/u)[line - 1] ?? "");
        return {
            value: {
                path: toPosix(input),
                sha256: sha256(content),
                ...(line === undefined ? {} : { line, excerpt_hash: sha256(excerpt ?? "") })
            },
            exitCode: 0
        };
    }
    if (nameInput === "validate-finding-schema") {
        const input = args[0];
        if (input === undefined)
            throw new Error("validate-finding-schema requires a JSON path under the project root");
        const parsed = JSON.parse(await readFile(resolveInside(root, input), "utf8"));
        const values = extractFindings(parsed);
        const errors = values.flatMap((value, index) => validateFinding(value).map((error) => `[${index}] ${error}`));
        return {
            value: { valid: errors.length === 0, count: values.length, errors },
            exitCode: errors.length === 0 ? 0 : 1
        };
    }
    if (nameInput === "validate-skill") {
        const validation = await validateBundledSkills();
        return { value: validation, exitCode: validation.errors.length === 0 ? 0 : 1 };
    }
    const scripts = {
        "sync-platform-assets": "sync-platform-assets.mjs",
        "check-platform-assets": "check-platform-assets.mjs",
        "package-platforms": "package-platforms.mjs",
        "smoke-install": "smoke-install.mjs"
    };
    const script = scripts[nameInput];
    if (script !== undefined) {
        const missing = await missingSourceCheckoutInputs(script);
        if (missing.length > 0)
            return {
                value: {
                    tool: nameInput,
                    status: "BLOCKED",
                    availability: "source-checkout-only",
                    missing,
                    recovery: "Run this maintainer tool from a complete Fullstack Forge source checkout; installed npm packages intentionally omit development-only sources and scripts."
                },
                exitCode: 2
            };
        const scriptArgs = options.dryRun
            ? [join(PACKAGE_ROOT, "scripts", script), "--dry-run"]
            : [join(PACKAGE_ROOT, "scripts", script)];
        const execution = await runFile(process.execPath, scriptArgs, PACKAGE_ROOT, 10 * 60_000);
        return { value: { tool: nameInput, ...execution }, exitCode: execution.exitCode };
    }
    throw new Error(`Internal dispatch invariant failed for tool '${nameInput}'`);
}
/**
 * True only when the audited root really is the Fullstack Forge package root.
 *
 * Both paths are canonicalized before comparison, so a project cannot claim the Forge-internal
 * exemption by naming a directory or a script the same way.
 */
export async function isForgePackageRoot(root) {
    try {
        return (await canonicalDirectory(root)) === (await canonicalDirectory(PACKAGE_ROOT));
    }
    catch {
        return false;
    }
}
export async function validateBundledSkills() {
    const errors = [];
    const expected = [...TOOL_NAMES];
    if (new Set(expected).size !== expected.length)
        errors.push("tool catalog contains duplicate names");
    const managed = await validateBundledManagedLayout();
    errors.push(...managed.errors);
    const canonicalRoot = join(PACKAGE_ROOT, ".fullstack-forge", "skills");
    const paths = [join(canonicalRoot, "fullstack-forge", "SKILL.md")];
    for (const slug of MODULE_SLUGS)
        paths.push(join(canonicalRoot, `forge-${slug}`, "SKILL.md"));
    for (const workflowCommand of ["forge", "forge-new", "forge-feature"])
        paths.push(join(canonicalRoot, workflowCommand, "SKILL.md"));
    for (const [index, path] of paths.entries()) {
        let content;
        try {
            content = await readFile(path, "utf8");
        }
        catch (error) {
            errors.push(`${path}: ${error.message}`);
            continue;
        }
        const lines = content.split(/\r?\n/u);
        if (lines.length > 500)
            errors.push(`${path}: exceeds 500 lines`);
        if (!/^---\r?\nname:\s*[a-z0-9-]+\r?\ndescription:\s*\S[\s\S]*?\r?\n---\r?\n/u.test(content)) {
            errors.push(`${path}: invalid name/description frontmatter`);
        }
        if (/\[TODO\]|(?:^|\n)\s*(?:[-*]\s*)?TODO(?:\s*:|\s*$)/iu.test(content))
            errors.push(`${path}: unresolved TODO placeholder`);
        if (!content.includes("Never hide failed checks or claim that an operation ran when it did not.")) {
            errors.push(`${path}: missing completion contract`);
        }
        if (index > 0 && index <= MODULE_SLUGS.length && !content.includes("## Missing-control checks"))
            errors.push(`${path}: missing missing-control checks heading`);
    }
    return { valid: errors.length === 0, skills: paths.length, errors };
}
export async function validateBundledManagedLayout() {
    const definitions = [
        [".agents/skills", "agents"],
        ["skills", "codex-plugin"],
        [".claude/skills", "claude"],
        [".cursor/skills", "cursor"],
        [".gemini/skills", "gemini"],
        [".github/skills", "github"],
        [".windsurf/skills", "windsurf"],
        [".fullstack-forge/skills", "canonical"],
        [".fullstack-forge/upstream", "upstream"],
        [".fullstack-forge/manifests", "manifests"],
        [".fullstack-forge/runtime", "runtime"]
    ];
    const errors = [];
    let files = 0;
    for (const [relativeRoot, platform] of definitions) {
        const root = join(PACKAGE_ROOT, ...relativeRoot.split("/"));
        const markerPath = join(root, ".fullstack-forge-generated.json");
        let marker;
        try {
            if ((await lstat(markerPath)).isSymbolicLink())
                throw new Error("manifest is a symlink");
            marker = JSON.parse(await readFile(markerPath, "utf8"));
        }
        catch (error) {
            errors.push(`${relativeRoot}: missing or invalid ownership manifest (${String(error)})`);
            continue;
        }
        if (!isOwnershipManifest(marker, platform)) {
            errors.push(`${relativeRoot}: unsupported ownership metadata`);
            continue;
        }
        const actual = new Map();
        try {
            for (const path of await walkRegularFiles(root)) {
                const rel = relative(root, path).split(sep).join("/");
                if (rel === ".fullstack-forge-generated.json")
                    continue;
                actual.set(rel, sha256(await readFile(path)));
            }
        }
        catch (error) {
            errors.push(`${relativeRoot}: ${String(error)}`);
            continue;
        }
        for (const [path, hash] of Object.entries(marker.files)) {
            let safePath;
            try {
                safePath = resolveInside(root, path);
            }
            catch (error) {
                errors.push(`${relativeRoot}: unsafe ownership path ${path} (${String(error)})`);
                continue;
            }
            if (relative(root, safePath).split(sep).join("/") !== path) {
                errors.push(`${relativeRoot}: non-canonical ownership path ${path}`);
                continue;
            }
            if (!/^[a-f0-9]{64}$/u.test(hash)) {
                errors.push(`${relativeRoot}: invalid ownership hash for ${path}`);
                continue;
            }
            const actualHash = actual.get(path);
            if (actualHash === undefined)
                errors.push(`${relativeRoot}: missing owned file ${path}`);
            else if (actualHash !== hash)
                errors.push(`${relativeRoot}: modified owned file ${path}`);
        }
        for (const path of actual.keys())
            if (!(path in marker.files))
                errors.push(`${relativeRoot}: unowned file ${path}`);
        files += actual.size;
    }
    return { valid: errors.length === 0, roots: definitions.length, files, errors };
}
async function missingSourceCheckoutInputs(script) {
    const required = [
        `scripts/${script}`,
        "scripts/project.mjs",
        "src/fullstack-forge/SKILL.md",
        "config/modules.json",
        "package-lock.json"
    ];
    const missing = [];
    for (const path of required) {
        try {
            await access(join(PACKAGE_ROOT, ...path.split("/")));
        }
        catch {
            missing.push(path);
        }
    }
    return missing;
}
async function walkRegularFiles(root) {
    const output = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const path = join(root, entry.name);
        if (entry.isSymbolicLink())
            throw new Error(`symlink is forbidden: ${path}`);
        if (entry.isDirectory())
            output.push(...(await walkRegularFiles(path)));
        else if (entry.isFile())
            output.push(path);
        else
            throw new Error(`unsupported filesystem entry: ${path}`);
    }
    return output;
}
function isOwnershipManifest(value, platform) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schemaVersion === 1 &&
        candidate.generator === "fullstack-forge" &&
        candidate.platform === platform &&
        typeof candidate.files === "object" &&
        candidate.files !== null &&
        !Array.isArray(candidate.files));
}
async function loadOrDiscoverProfile(root) {
    try {
        const parsed = JSON.parse(await readFile(join(root, ".forge", "project-profile.json"), "utf8"));
        if (isProjectProfile(parsed))
            return parsed;
        if (isLegacyProjectProfile(parsed))
            return discoverProject(root);
        throw new Error("Invalid .forge/project-profile.json");
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
        return discoverProject(root);
    }
}
function isProjectProfile(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schema_version === 2 &&
        typeof candidate.root === "string" &&
        typeof candidate.generated_at === "string" &&
        Array.isArray(candidate.detections) &&
        typeof candidate.capabilities === "object" &&
        candidate.capabilities !== null &&
        !Array.isArray(candidate.capabilities) &&
        typeof candidate.repository === "object" &&
        candidate.repository !== null &&
        [
            "workspaces",
            "applications",
            "languages",
            "frameworks",
            "package_managers",
            "databases",
            "orms",
            "authentication",
            "sessions",
            "authorization",
            "roles",
            "tenant_boundaries",
            "routes",
            "storage",
            "upload_pipelines",
            "caches",
            "queues",
            "scheduled_jobs",
            "tests",
            "ci",
            "observability",
            "integrations",
            "ai_providers",
            "payment_providers",
            "hosting",
            "deployment",
            "environment_templates",
            "critical_workflows"
        ].every((field) => Array.isArray(candidate[field])));
}
function isLegacyProjectProfile(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    const candidate = value;
    return (candidate.schema_version === 1 &&
        typeof candidate.root === "string" &&
        Array.isArray(candidate.detections) &&
        typeof candidate.capabilities === "object" &&
        candidate.capabilities !== null);
}
function extractFindings(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value === "object" && value !== null && "findings" in value) {
        const findings = value.findings;
        if (Array.isArray(findings))
            return findings;
    }
    return [value];
}
function isToolName(value) {
    return TOOL_NAMES.includes(value);
}
function isInspectionTool(value) {
    if (value === "inspect-rendered-ui")
        return false;
    return value.startsWith("inspect-") && value !== "inspect-platform-skills"
        ? true
        : value === "inspect-platform-skills" || value === "scan-secret-patterns";
}
