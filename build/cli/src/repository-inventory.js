import { execFile } from "node:child_process";
import { lstat, open, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export const DEFAULT_INSPECTION_BUDGET_BYTES = 128 * 1024 * 1024;
export const MAX_INSPECTION_BUDGET_BYTES = 512 * 1024 * 1024;
export const DEFAULT_PER_FILE_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_INVENTORY_ENTRIES = 100_000;
export const DEFAULT_MAX_DIRECTORY_DEPTH = 64;
export const DEFAULT_EXCLUSION_CATEGORIES = Object.freeze({
    "forge-private-state": [".git", ".audit", ".audit-work", ".codex", ".forge", ".fullstack-forge"],
    "dependency-vendor-trees": ["node_modules", "vendor"],
    "generated-build-output": [
        ".next",
        ".nuxt",
        ".output",
        ".svelte-kit",
        "build",
        "coverage",
        "dist",
        "out",
        "target"
    ],
    "framework-caches": [
        ".cache",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".turbo",
        ".tox",
        "__pycache__"
    ],
    "local-development-environments": [".gradle", ".idea", ".venv", ".vscode", "env", "venv"],
    "runtime-private-data": ["attachments", "backups", "logs", "uploads"],
    "temporary-data": [".tmp", "temp"]
});
const ALWAYS_EXCLUDED = new Set([
    ".git",
    ...DEFAULT_EXCLUSION_CATEGORIES["forge-private-state"],
    ...DEFAULT_EXCLUSION_CATEGORIES["dependency-vendor-trees"],
    ...DEFAULT_EXCLUSION_CATEGORIES["local-development-environments"],
    ...DEFAULT_EXCLUSION_CATEGORIES["temporary-data"]
]);
const GENERATED_OR_CACHE = new Set([
    ...DEFAULT_EXCLUSION_CATEGORIES["generated-build-output"],
    ...DEFAULT_EXCLUSION_CATEGORIES["framework-caches"]
]);
const GENERIC_OUTPUT_DIRECTORIES = new Set(["build", "coverage", "dist", "out", "target"]);
const BINARY_EXTENSIONS = new Set([
    ".7z",
    ".a",
    ".avi",
    ".avif",
    ".bin",
    ".bmp",
    ".class",
    ".db",
    ".dll",
    ".dylib",
    ".eot",
    ".exe",
    ".flac",
    ".gif",
    ".gz",
    ".ico",
    ".jar",
    ".jpeg",
    ".jpg",
    ".lib",
    ".lockb",
    ".map",
    ".mkv",
    ".mov",
    ".mp3",
    ".mp4",
    ".o",
    ".obj",
    ".ogg",
    ".otf",
    ".pdf",
    ".png",
    ".pyc",
    ".pyd",
    ".so",
    ".sqlite",
    ".sqlite3",
    ".tar",
    ".tgz",
    ".ttf",
    ".wav",
    ".webm",
    ".webp",
    ".woff",
    ".woff2",
    ".xz",
    ".zip"
]);
const CLEAR_RUNTIME_PRIVATE_EXTENSIONS = new Set([
    ...BINARY_EXTENSIONS,
    ".bak",
    ".cache",
    ".log",
    ".pid",
    ".tmp"
]);
const TEXT_EXTENSIONS = new Set([
    ".astro",
    ".bash",
    ".c",
    ".cc",
    ".cfg",
    ".cjs",
    ".conf",
    ".cpp",
    ".cs",
    ".css",
    ".csv",
    ".cts",
    ".env",
    ".go",
    ".graphql",
    ".gql",
    ".h",
    ".hpp",
    ".htm",
    ".html",
    ".ini",
    ".java",
    ".js",
    ".json",
    ".jsonc",
    ".jsx",
    ".kt",
    ".kts",
    ".less",
    ".md",
    ".mdx",
    ".mjs",
    ".mts",
    ".php",
    ".prisma",
    ".properties",
    ".proto",
    ".ps1",
    ".py",
    ".rb",
    ".rs",
    ".sass",
    ".scss",
    ".sh",
    ".sql",
    ".svelte",
    ".swift",
    ".tf",
    ".tfvars",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
    ".zsh"
]);
const TEXT_NAMES = /^(?:Dockerfile|Jenkinsfile|Makefile|Procfile|Rakefile|Gemfile|go\.mod|go\.sum|gradlew|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.env(?:\..+)?)$/u;
const DOCUMENTATION_SEGMENTS = new Set(["doc", "docs", "documentation"]);
const FIXTURE_SEGMENTS = new Set(["fixture", "fixtures", "test-data", "testdata"]);
const EXAMPLE_SEGMENTS = new Set(["demo", "demos", "example", "examples", "sample", "samples"]);
const TEST_SEGMENTS = new Set(["__tests__", "spec", "specs", "test", "tests"]);
export async function inventoryRepository(rootInput, options = {}) {
    const root = await canonicalInventoryRoot(rootInput);
    const inspectionBudgetBytes = options.inspectionBudgetBytes ?? DEFAULT_INSPECTION_BUDGET_BYTES;
    const perFileLimitBytes = options.maxFileBytes ?? DEFAULT_PER_FILE_BYTES;
    const maxEntries = options.maxEntries ?? DEFAULT_MAX_INVENTORY_ENTRIES;
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DIRECTORY_DEPTH;
    validateBudget("inspection budget", inspectionBudgetBytes, MAX_INSPECTION_BUDGET_BYTES);
    validateBudget("per-file limit", perFileLimitBytes, MAX_INSPECTION_BUDGET_BYTES);
    validateBudget("inventory entry limit", maxEntries, 1_000_000);
    validateBudget("directory depth", maxDepth, 256);
    const forgeignore = await loadIgnoreFile(root, ".forgeignore", true);
    const gitignore = await loadIgnoreFile(root, ".gitignore", false);
    const cliPatterns = compilePatterns(options.exclude ?? [], "--exclude", true);
    const policyPatterns = compilePatterns(options.policyExclude ?? [], "internal policy", true);
    const userPatterns = [...forgeignore.patterns, ...cliPatterns];
    const discovery = await discoverCandidates(root, {
        maxEntries,
        maxDepth,
        policyPatterns,
        userPatterns,
        gitignorePatterns: gitignore.patterns,
        applyDefaultExclusions: options.applyDefaultExclusions !== false
    });
    const entries = [];
    const excludedPaths = [...discovery.fallbackExcluded];
    const directoryBytes = new Map();
    let bytesConsidered = 0;
    let bytesRead = 0;
    let binaryProbeBytes = 0;
    let binarySkipped = 0;
    let ignoredExcluded = discovery.fallbackExcluded.filter((item) => item.category === "gitignore").length;
    let generatedExcluded = discovery.fallbackExcluded.filter((item) => item.category === "generated").length;
    let defaultExcluded = discovery.fallbackExcluded.filter((item) => item.category.startsWith("default:")).length;
    let userExcluded = discovery.fallbackExcluded.filter((item) => item.category === "user").length;
    let requiredEvidenceExcluded = false;
    let partialReason = discovery.partialReason;
    const neutralRepresentatives = new Map();
    if (discovery.fallbackExcluded.some((item) => item.category === "user" && !isNeutralEvidence(classifyInventoryPath(item.path))))
        requiredEvidenceExcluded = true;
    for (const candidate of discovery.candidates) {
        const safePath = normalizeSafeRelative(candidate.path);
        const policyMatch = matchingPattern(safePath, policyPatterns);
        if (policyMatch !== undefined) {
            excludedPaths.push({
                path: safePath,
                category: "internal-policy",
                pattern: policyMatch.source
            });
            continue;
        }
        const userMatch = matchingPattern(safePath, userPatterns);
        if (userMatch !== undefined) {
            const evidenceClass = classifyInventoryPath(safePath);
            excludedPaths.push({ path: safePath, category: "user", pattern: userMatch.source });
            userExcluded += 1;
            if (!isNeutralEvidence(evidenceClass))
                requiredEvidenceExcluded = true;
            continue;
        }
        const gitignoreMatch = candidate.origin === "fallback" ? matchingPattern(safePath, gitignore.patterns) : undefined;
        if (gitignoreMatch !== undefined) {
            excludedPaths.push({ path: safePath, category: "gitignore", pattern: gitignoreMatch.source });
            ignoredExcluded += 1;
            continue;
        }
        const evidenceClass = classifyInventoryPath(safePath);
        const defaultCategory = options.applyDefaultExclusions === false ? undefined : defaultExclusionCategory(safePath);
        const defaultDecision = defaultExclusionDecision(safePath, candidate.origin, evidenceClass, defaultCategory);
        if (defaultDecision === "exclude" && defaultCategory !== undefined) {
            excludedPaths.push({
                path: safePath,
                category: defaultCategory.category === "generated-build-output" ||
                    defaultCategory.category === "framework-caches"
                    ? "generated"
                    : `default:${defaultCategory.category}`
            });
            if (defaultCategory.category === "generated-build-output" ||
                defaultCategory.category === "framework-caches")
                generatedExcluded += 1;
            else
                defaultExcluded += 1;
            continue;
        }
        if (defaultDecision === "partial") {
            const absolutePath = resolveInventoryPath(root, safePath);
            excludedPaths.push({
                path: safePath,
                category: "default:runtime-private-data-ambiguous"
            });
            defaultExcluded += 1;
            requiredEvidenceExcluded = true;
            partialReason ??= "runtime-private-data-ambiguous";
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size: 0,
                status: "SKIPPED",
                reason: "runtime-private-data-ambiguous"
            });
            continue;
        }
        const absolutePath = resolveInventoryPath(root, safePath);
        let size;
        try {
            const info = await lstat(absolutePath);
            if (info.isSymbolicLink()) {
                entries.push({
                    path: safePath,
                    absolute_path: absolutePath,
                    origin: candidate.origin,
                    evidence_class: evidenceClass,
                    size: 0,
                    status: "SKIPPED",
                    reason: "symlink-or-reparse-point"
                });
                continue;
            }
            if (!info.isFile())
                continue;
            size = info.size;
        }
        catch (error) {
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size: 0,
                status: "SKIPPED",
                reason: `metadata-unavailable:${errorCode(error)}`
            });
            partialReason ??= "file-metadata-unavailable";
            continue;
        }
        bytesConsidered += size;
        const extension = extensionOf(safePath);
        if (!options.includeBinary && BINARY_EXTENSIONS.has(extension)) {
            binarySkipped += 1;
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "SKIPPED",
                reason: "unsupported-binary-file-class"
            });
            continue;
        }
        if (!options.includeBinary && evidenceClass === "generated" && candidate.origin === "tracked") {
            generatedExcluded += 1;
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "SKIPPED",
                reason: "tracked-generated-path-neutralized"
            });
            continue;
        }
        if (!options.includeBinary && isNeutralEvidence(evidenceClass)) {
            if (options.includeNeutralEvidence === false) {
                entries.push({
                    path: safePath,
                    absolute_path: absolutePath,
                    origin: candidate.origin,
                    evidence_class: evidenceClass,
                    size,
                    status: "SKIPPED",
                    reason: "neutral-evidence-not-requested"
                });
                continue;
            }
            const representativeKey = `${evidenceClass}:${topLevel(safePath)}`;
            const seen = neutralRepresentatives.get(representativeKey) ?? 0;
            if (seen >= 8) {
                entries.push({
                    path: safePath,
                    absolute_path: absolutePath,
                    origin: candidate.origin,
                    evidence_class: evidenceClass,
                    size,
                    status: "SKIPPED",
                    reason: "neutral-evidence-representative-limit"
                });
                continue;
            }
            neutralRepresentatives.set(representativeKey, seen + 1);
        }
        if (size > perFileLimitBytes) {
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "SKIPPED",
                reason: `per-file-limit-exceeded:${perFileLimitBytes}`
            });
            if (!options.includeBinary && !isNeutralEvidence(evidenceClass))
                partialReason ??= "per-file-limit-exceeded";
            continue;
        }
        if (options.includeBinary) {
            if (bytesRead + size > inspectionBudgetBytes) {
                entries.push({
                    path: safePath,
                    absolute_path: absolutePath,
                    origin: candidate.origin,
                    evidence_class: evidenceClass,
                    size,
                    status: "SKIPPED",
                    reason: "inspection-budget-exhausted"
                });
                partialReason ??= "inspection-budget-exhausted";
                continue;
            }
            bytesRead += size;
            addDirectoryBytes(directoryBytes, safePath, size);
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "INSPECTED"
            });
            continue;
        }
        const knownText = TEXT_EXTENSIONS.has(extension) || TEXT_NAMES.test(fileNameOf(safePath));
        if (!knownText) {
            const probe = await binaryProbe(absolutePath);
            binaryProbeBytes += probe.bytesRead;
            if (probe.binary) {
                binarySkipped += 1;
                entries.push({
                    path: safePath,
                    absolute_path: absolutePath,
                    origin: candidate.origin,
                    evidence_class: evidenceClass,
                    size,
                    status: "SKIPPED",
                    reason: "binary-probe-detected-binary"
                });
                continue;
            }
        }
        if (bytesRead + size > inspectionBudgetBytes) {
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "SKIPPED",
                reason: "inspection-budget-exhausted"
            });
            partialReason ??= "inspection-budget-exhausted";
            continue;
        }
        try {
            const bytes = await readFile(absolutePath);
            if (bytes.includes(0)) {
                binarySkipped += 1;
                entries.push({
                    path: safePath,
                    absolute_path: absolutePath,
                    origin: candidate.origin,
                    evidence_class: evidenceClass,
                    size,
                    status: "SKIPPED",
                    reason: "binary-content-detected"
                });
                continue;
            }
            bytesRead += bytes.length;
            addDirectoryBytes(directoryBytes, safePath, bytes.length);
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "INSPECTED",
                content: bytes.toString("utf8")
            });
        }
        catch (error) {
            entries.push({
                path: safePath,
                absolute_path: absolutePath,
                origin: candidate.origin,
                evidence_class: evidenceClass,
                size,
                status: "SKIPPED",
                reason: `read-failed:${errorCode(error)}`
            });
            if (!isNeutralEvidence(evidenceClass))
                partialReason ??= "relevant-file-read-failed";
        }
    }
    if (requiredEvidenceExcluded)
        partialReason ??= "user-exclusions-affect-required-evidence";
    const status = partialReason === undefined ? "COMPLETE" : "PARTIAL";
    const diagnostics = {
        status,
        ...(partialReason === undefined ? {} : { reason: partialReason }),
        source: discovery.source,
        ...(discovery.gitRoot === undefined ? {} : { git_root: discovery.gitRoot }),
        ...(discovery.gitFailure === undefined ? {} : { git_failure: discovery.gitFailure }),
        candidate_files_discovered: discovery.candidates.length,
        files_inspected: entries.filter((entry) => entry.status === "INSPECTED").length,
        files_skipped: entries.filter((entry) => entry.status === "SKIPPED").length,
        bytes_considered: bytesConsidered,
        bytes_read: bytesRead,
        binary_probe_bytes: binaryProbeBytes,
        binary_files_skipped: binarySkipped,
        ignored_paths_excluded: ignoredExcluded,
        generated_paths_excluded: generatedExcluded,
        default_paths_excluded: defaultExcluded,
        user_paths_excluded: userExcluded,
        required_evidence_excluded: requiredEvidenceExcluded,
        per_file_limit_bytes: perFileLimitBytes,
        inspection_budget_bytes: inspectionBudgetBytes,
        max_inventory_entries: maxEntries,
        max_directory_depth: maxDepth,
        forgeignore_patterns: forgeignore.patterns.map((pattern) => pattern.source),
        cli_exclusions: cliPatterns.map((pattern) => pattern.source),
        excluded_paths: excludedPaths.slice(0, 200),
        largest_inspected_files: entries
            .filter((entry) => entry.status === "INSPECTED")
            .map((entry) => ({ path: entry.path, bytes: entry.size }))
            .sort(compareContributors)
            .slice(0, 10),
        largest_contributing_directories: [...directoryBytes.entries()]
            .map(([path, bytes]) => ({ path, bytes }))
            .sort(compareContributors)
            .slice(0, 10),
        affected_modules: status === "PARTIAL" ? ["discovery", "applicable-audit-modules", "ship"] : [],
        suggested_actions: status === "PARTIAL"
            ? [
                "Add generated or private paths to .forgeignore after reviewing them.",
                "Use repeatable --exclude <path> for reviewed non-evidence paths.",
                "Audit a narrower workspace root.",
                "Increase --inspection-budget only after reviewing the largest contributors."
            ]
            : []
    };
    if (options.throwOnPartial && status === "PARTIAL")
        throw new Error(renderInventoryIncomplete(diagnostics));
    return { root, entries, diagnostics };
}
export async function walkRepositoryPaths(rootInput, options = {}) {
    return inventoryRepository(rootInput, {
        ...options,
        includeBinary: true,
        includeNeutralEvidence: true,
        applyDefaultExclusions: options.applyDefaultExclusions ?? false
    });
}
export function parseInspectionBudget(value) {
    const match = /^([1-9][0-9]*)(?:\s*(B|KiB|MiB))?$/u.exec(value.trim());
    if (match === null)
        throw new Error(`Option '--inspection-budget' requires a positive byte, KiB, or MiB value, got '${value}'`);
    const amount = Number(match[1]);
    const unit = match[2] ?? "B";
    const multiplier = unit === "MiB" ? 1024 * 1024 : unit === "KiB" ? 1024 : 1;
    const bytes = amount * multiplier;
    validateBudget("inspection budget", bytes, MAX_INSPECTION_BUDGET_BYTES);
    return bytes;
}
export function validateExclusionPattern(value, source = "--exclude") {
    const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//u, "");
    const withoutTrailingSlash = normalized.replace(/\/+$/u, "");
    const segments = withoutTrailingSlash.split("/");
    if (normalized.length === 0 ||
        normalized.includes("\0") ||
        normalized.startsWith("/") ||
        isAbsolute(normalized) ||
        /^[A-Za-z]:/u.test(normalized) ||
        normalized.startsWith("//") ||
        segments.some((segment) => segment === "" ||
            segment === "." ||
            segment === ".." ||
            segment.includes(":") ||
            /[. ]$/u.test(segment) ||
            [...segment].some((character) => character.charCodeAt(0) < 0x20)))
        throw new Error(`${source} pattern must be repository-relative and cannot escape the root: ${value}`);
    if (normalized.startsWith("!"))
        throw new Error(`${source} negation patterns are not supported; use an explicit include scope`);
    return normalized;
}
export function classifyInventoryPath(path) {
    const normalized = normalizeSafeRelative(path);
    const segments = normalized.split("/");
    const lowerDirectories = segments.slice(0, -1).map((segment) => segment.toLowerCase());
    const name = (segments.at(-1) ?? "").toLowerCase();
    if (lowerDirectories.some((segment, index) => GENERATED_OR_CACHE.has(segment) && (!GENERIC_OUTPUT_DIRECTORIES.has(segment) || index === 0)) ||
        /\.(?:generated|min)\.[^.]+$/u.test(name) ||
        name.endsWith(".d.ts") ||
        name.endsWith(".map"))
        return "generated";
    if (lowerDirectories.some((segment) => DOCUMENTATION_SEGMENTS.has(segment)))
        return "documentation";
    if (lowerDirectories.some((segment) => FIXTURE_SEGMENTS.has(segment)))
        return "fixture";
    if (lowerDirectories.some((segment) => TEST_SEGMENTS.has(segment)) ||
        /\.(?:spec|test)\.[^.]+$/u.test(name))
        return "test";
    if (lowerDirectories.some((segment) => EXAMPLE_SEGMENTS.has(segment)))
        return "example";
    if (isManifestName(name))
        return "manifest";
    if (name.startsWith(".env.") ||
        /\.(?:cfg|conf|ini|json|jsonc|toml|ya?ml)$/u.test(name) ||
        /^(?:Dockerfile|Jenkinsfile|Makefile|Procfile)$/u.test(segments.at(-1) ?? ""))
        return "configuration";
    if (TEXT_EXTENSIONS.has(extensionOf(normalized)))
        return "production";
    return "unknown";
}
export function renderInventoryIncomplete(diagnostics) {
    const contributors = diagnostics.largest_contributing_directories.length === 0
        ? "- no contributing directory was fully inspected"
        : diagnostics.largest_contributing_directories
            .slice(0, 5)
            .map((item) => `- ${item.path} (${item.bytes} bytes read)`)
            .join("\n");
    return `Repository inspection was incomplete.

Forge inspected ${diagnostics.files_inspected} relevant text files and read ${diagnostics.bytes_read} bytes.
Reason: ${diagnostics.reason ?? "bounded inventory was incomplete"}.
Largest inspected contributors:
${contributors}

Result: NOT_VERIFIED
Exit code: 2

Next actions:
${diagnostics.suggested_actions.map((action) => `- ${action}`).join("\n")}`;
}
async function discoverCandidates(root, options) {
    const gitRootResult = await runGit(root, ["rev-parse", "--show-toplevel"], 1024 * 1024);
    if (gitRootResult.exitCode === 0) {
        const gitRoot = await realpath(gitRootResult.stdout.trim());
        if (isInsideInventoryRoot(gitRoot, root)) {
            const all = await runGit(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."], 16 * 1024 * 1024);
            const tracked = await runGit(root, ["ls-files", "-z", "--cached", "--", "."], 16 * 1024 * 1024);
            if (all.exitCode === 0 && tracked.exitCode === 0) {
                const trackedSet = new Set(splitNul(tracked.stdout).map(normalizeSafeRelative));
                const paths = [...new Set(splitNul(all.stdout).map(normalizeSafeRelative))].sort(compareText);
                const partialReason = paths.length > options.maxEntries ? "inventory-entry-limit-exceeded" : undefined;
                return {
                    source: "git",
                    gitRoot,
                    candidates: paths
                        .slice(0, options.maxEntries)
                        .map((path) => ({ path, origin: trackedSet.has(path) ? "tracked" : "untracked" })),
                    fallbackExcluded: [],
                    ...(partialReason === undefined ? {} : { partialReason })
                };
            }
            const failure = compactFailure(all.exitCode === 0 ? tracked : all);
            const fallback = await fallbackCandidates(root, options);
            return { ...fallback, gitRoot, gitFailure: failure };
        }
        const fallback = await fallbackCandidates(root, options);
        return {
            ...fallback,
            gitFailure: `selected root is outside discovered Git root '${gitRoot}'`
        };
    }
    const fallback = await fallbackCandidates(root, options);
    return {
        ...fallback,
        gitFailure: compactFailure(gitRootResult)
    };
}
async function fallbackCandidates(root, options) {
    const candidates = [];
    const excluded = [];
    let partialReason;
    async function visit(directory, depth) {
        if (partialReason === "inventory-entry-limit-exceeded")
            return;
        const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => compareText(a.name, b.name));
        for (const entry of entries) {
            const absolutePath = join(directory, entry.name);
            const path = normalizeSafeRelative(relative(root, absolutePath));
            if (entry.isSymbolicLink()) {
                excluded.push({ path, category: "symlink-or-reparse-point" });
                continue;
            }
            const policyMatch = matchingPattern(path, options.policyPatterns);
            const userMatch = matchingPattern(path, options.userPatterns);
            const gitignoreMatch = matchingPattern(path, options.gitignorePatterns);
            const evidenceClass = classifyInventoryPath(path);
            const defaultCategory = options.applyDefaultExclusions
                ? defaultExclusionCategory(path)
                : undefined;
            if (policyMatch !== undefined) {
                excluded.push({
                    path,
                    category: "internal-policy",
                    pattern: policyMatch.source
                });
                continue;
            }
            if (userMatch !== undefined) {
                excluded.push({ path, category: "user", pattern: userMatch.source });
                continue;
            }
            if (gitignoreMatch !== undefined) {
                excluded.push({ path, category: "gitignore", pattern: gitignoreMatch.source });
                continue;
            }
            if (defaultExclusionDecision(path, "fallback", evidenceClass, defaultCategory) === "exclude" &&
                defaultCategory !== undefined) {
                excluded.push({
                    path,
                    category: defaultCategory.category === "generated-build-output" ||
                        defaultCategory.category === "framework-caches"
                        ? "generated"
                        : `default:${defaultCategory.category}`
                });
                continue;
            }
            if (entry.isDirectory()) {
                if (depth >= options.maxDepth) {
                    partialReason ??= "directory-depth-limit-exceeded";
                    excluded.push({ path, category: "depth-limit" });
                    continue;
                }
                await visit(absolutePath, depth + 1);
            }
            else if (entry.isFile()) {
                if (candidates.length >= options.maxEntries) {
                    partialReason = "inventory-entry-limit-exceeded";
                    return;
                }
                candidates.push({ path, origin: "fallback" });
            }
        }
    }
    await visit(root, 0);
    return {
        source: "fallback",
        candidates: candidates.sort((a, b) => compareText(a.path, b.path)),
        fallbackExcluded: excluded,
        ...(partialReason === undefined ? {} : { partialReason })
    };
}
async function loadIgnoreFile(root, name, strict) {
    const path = join(root, name);
    let text;
    try {
        const info = await stat(path);
        if (!info.isFile())
            return { patterns: [] };
        if (info.size > 256 * 1024)
            throw new Error(`${name} exceeds the 262144-byte policy limit`);
        text = await readFile(path, "utf8");
    }
    catch (error) {
        if (errorCode(error) === "ENOENT")
            return { patterns: [] };
        if (strict)
            throw error;
        return { patterns: [] };
    }
    const values = [];
    for (const [index, raw] of text.split(/\r?\n/u).entries()) {
        const value = raw.trim();
        if (value.length === 0 || value.startsWith("#"))
            continue;
        if (value.startsWith("!")) {
            if (strict)
                throw new Error(`${name}:${index + 1}: negation patterns are not supported; use a narrower positive exclusion`);
            continue;
        }
        try {
            values.push(validateExclusionPattern(value, `${name}:${index + 1}`));
        }
        catch (error) {
            if (strict)
                throw error;
        }
    }
    return { patterns: compilePatterns(values, name, false) };
}
function compilePatterns(values, source, validate) {
    const unique = new Set();
    for (const value of values)
        unique.add(validate ? validateExclusionPattern(value, source) : value);
    return [...unique].sort(compareText).map((pattern) => ({
        source: pattern,
        regex: patternRegex(pattern)
    }));
}
function patternRegex(pattern) {
    const directoryOnly = pattern.endsWith("/");
    const normalized = pattern.replace(/\/+$/u, "");
    let expression = "";
    for (let index = 0; index < normalized.length; index += 1) {
        const character = normalized[index] ?? "";
        if (character === "*") {
            if (normalized[index + 1] === "*") {
                expression += ".*";
                index += 1;
            }
            else
                expression += "[^/]*";
        }
        else if (character === "?")
            expression += "[^/]";
        else
            expression += escapeRegex(character);
    }
    const prefix = normalized.includes("/") ? "^" : "(?:^|/)";
    const suffix = directoryOnly ? "(?:/.*)?$" : "(?:$|/.*$)";
    return new RegExp(`${prefix}${expression}${suffix}`, "u");
}
function matchingPattern(path, patterns) {
    return patterns.find((pattern) => pattern.regex.test(path));
}
function defaultExclusionCategory(path) {
    const segments = path.split("/");
    for (const [category, values] of Object.entries(DEFAULT_EXCLUSION_CATEGORIES)) {
        const segmentIndex = segments.findIndex((segment, index) => values.includes(segment.toLowerCase()) &&
            (!GENERIC_OUTPUT_DIRECTORIES.has(segment.toLowerCase()) || index === 0));
        if (segmentIndex !== -1) {
            const segment = segments[segmentIndex];
            if (segment !== undefined)
                return { category, segment: segment.toLowerCase(), segmentIndex };
        }
    }
    return undefined;
}
function defaultExclusionDecision(path, origin, evidenceClass, category) {
    if (category === undefined)
        return "inspect";
    if (category.category !== "runtime-private-data")
        return origin !== "tracked" || ALWAYS_EXCLUDED.has(category.segment) ? "exclude" : "inspect";
    if (origin === "tracked" || category.segmentIndex !== 0)
        return "inspect";
    if (isClearlyRuntimePrivateFile(path) || isNeutralEvidence(evidenceClass))
        return "exclude";
    return "partial";
}
function isClearlyRuntimePrivateFile(path) {
    return CLEAR_RUNTIME_PRIVATE_EXTENSIONS.has(extensionOf(path));
}
async function binaryProbe(path) {
    const handle = await open(path, "r");
    try {
        const buffer = Buffer.alloc(8192);
        const result = await handle.read(buffer, 0, buffer.length, 0);
        const bytes = buffer.subarray(0, result.bytesRead);
        if (bytes.includes(0))
            return { binary: true, bytesRead: result.bytesRead };
        let controls = 0;
        for (const byte of bytes)
            if (byte < 0x09 || (byte > 0x0d && byte < 0x20))
                controls += 1;
        return {
            binary: result.bytesRead > 0 && controls / result.bytesRead > 0.1,
            bytesRead: result.bytesRead
        };
    }
    finally {
        await handle.close();
    }
}
async function runGit(cwd, args, maxBuffer) {
    try {
        const result = await execFileAsync("git", args, {
            cwd,
            encoding: "utf8",
            timeout: 30_000,
            windowsHide: true,
            maxBuffer
        });
        return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    }
    catch (error) {
        const failure = error;
        return {
            exitCode: typeof failure.code === "number" ? failure.code : 1,
            stdout: failure.stdout ?? "",
            stderr: failure.stderr ?? failure.message
        };
    }
}
async function canonicalInventoryRoot(path) {
    const resolved = resolve(path);
    const info = await stat(resolved);
    if (!info.isDirectory())
        throw new Error(`Not a directory: ${resolved}`);
    return realpath(resolved);
}
function normalizeSafeRelative(path) {
    const normalized = path.split(sep).join("/").replaceAll("\\", "/").replace(/^\.\//u, "");
    if (normalized.length === 0 ||
        normalized.includes("\0") ||
        normalized.startsWith("/") ||
        isAbsolute(normalized) ||
        /^[A-Za-z]:/u.test(normalized) ||
        normalized.split("/").some((segment) => segment === "" || segment === "." || segment === ".."))
        throw new Error(`Unsafe repository inventory path: ${path}`);
    return normalized;
}
function resolveInventoryPath(root, path) {
    const safe = normalizeSafeRelative(path);
    const candidate = resolve(root, ...safe.split("/"));
    if (!isInsideInventoryRoot(root, candidate))
        throw new Error(`Repository inventory path escapes selected root: ${path}`);
    return candidate;
}
function isInsideInventoryRoot(root, candidate) {
    const path = relative(resolve(root), resolve(candidate));
    return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}
function isNeutralEvidence(value) {
    return ["documentation", "example", "fixture", "generated", "test"].includes(value);
}
function isManifestName(name) {
    return /^(?:cargo\.toml|gemfile|go\.mod|package\.json|pom\.xml|pyproject\.toml|requirements[^/]*\.txt|settings\.gradle(?:\.kts)?|build\.gradle(?:\.kts)?)$/u.test(name);
}
function extensionOf(path) {
    const name = fileNameOf(path).toLowerCase();
    const index = name.lastIndexOf(".");
    return index <= 0 ? "" : name.slice(index);
}
function fileNameOf(path) {
    return path.split("/").at(-1) ?? path;
}
function topLevel(path) {
    return path.split("/")[0] ?? ".";
}
function splitNul(value) {
    return value.split("\0").filter((item) => item.length > 0);
}
function addDirectoryBytes(target, path, bytes) {
    const segments = path.split("/").slice(0, -1);
    const directory = segments.length === 0 ? "." : segments.slice(0, 2).join("/");
    target.set(directory, (target.get(directory) ?? 0) + bytes);
}
function compareText(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
function compareContributors(a, b) {
    return b.bytes - a.bytes || compareText(a.path, b.path);
}
function compactFailure(result) {
    return `git exit ${result.exitCode}: ${(result.stderr || result.stdout || "no diagnostic")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, 500)}`;
}
function errorCode(error) {
    const code = error.code;
    return typeof code === "string" ? code : "UNKNOWN";
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function validateBudget(name, value, maximum) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum)
        throw new Error(`${name} must be a positive integer no greater than ${maximum}, got ${value}`);
}
//# sourceMappingURL=repository-inventory.js.map