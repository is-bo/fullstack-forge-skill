export declare const DEFAULT_INSPECTION_BUDGET_BYTES: number;
export declare const MAX_INSPECTION_BUDGET_BYTES: number;
export declare const DEFAULT_PER_FILE_BYTES: number;
export declare const DEFAULT_MAX_INVENTORY_ENTRIES = 100000;
export declare const DEFAULT_MAX_DIRECTORY_DEPTH = 64;
export declare const DEFAULT_EXCLUSION_CATEGORIES: Readonly<{
    readonly "forge-private-state": readonly [".git", ".audit", ".audit-work", ".codex", ".forge", ".fullstack-forge"];
    readonly "dependency-vendor-trees": readonly ["node_modules", "vendor"];
    readonly "generated-build-output": readonly [".next", ".nuxt", ".output", ".svelte-kit", "build", "coverage", "dist", "out", "target"];
    readonly "framework-caches": readonly [".cache", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".turbo", ".tox", "__pycache__"];
    readonly "local-development-environments": readonly [".gradle", ".idea", ".venv", ".vscode", "env", "venv"];
    readonly "runtime-private-data": readonly ["attachments", "backups", "logs", "uploads"];
    readonly "temporary-data": readonly [".tmp", "temp"];
}>;
export type InventoryStatus = "COMPLETE" | "PARTIAL";
export type InventorySource = "git" | "fallback";
export type InventoryEvidenceClass = "configuration" | "documentation" | "example" | "fixture" | "generated" | "manifest" | "production" | "test" | "unknown";
export type InventoryEntryStatus = "INSPECTED" | "SKIPPED";
export type RepositoryInventoryEntry = {
    path: string;
    absolute_path: string;
    origin: "tracked" | "untracked" | "fallback";
    evidence_class: InventoryEvidenceClass;
    size: number;
    status: InventoryEntryStatus;
    reason?: string;
    content?: string;
};
export type InventoryContributor = {
    path: string;
    bytes: number;
};
export type RepositoryInventoryDiagnostics = {
    status: InventoryStatus;
    reason?: string;
    source: InventorySource;
    git_root?: string;
    git_failure?: string;
    candidate_files_discovered: number;
    files_inspected: number;
    files_skipped: number;
    bytes_considered: number;
    bytes_read: number;
    binary_probe_bytes: number;
    binary_files_skipped: number;
    ignored_paths_excluded: number;
    generated_paths_excluded: number;
    default_paths_excluded: number;
    user_paths_excluded: number;
    required_evidence_excluded: boolean;
    per_file_limit_bytes: number;
    inspection_budget_bytes: number;
    max_inventory_entries: number;
    max_directory_depth: number;
    forgeignore_patterns: string[];
    cli_exclusions: string[];
    excluded_paths: Array<{
        path: string;
        category: string;
        pattern?: string;
    }>;
    largest_inspected_files: InventoryContributor[];
    largest_contributing_directories: InventoryContributor[];
    affected_modules: string[];
    suggested_actions: string[];
};
export type RepositoryInventory = {
    root: string;
    entries: RepositoryInventoryEntry[];
    diagnostics: RepositoryInventoryDiagnostics;
};
export type RepositoryInventoryOptions = {
    exclude?: readonly string[];
    /**
     * Package-owned exclusions used by compatibility callers. Unlike .forgeignore and --exclude,
     * these do not make an audit partial because they are not an operator claim about evidence.
     */
    policyExclude?: readonly string[];
    inspectionBudgetBytes?: number;
    maxFileBytes?: number;
    maxEntries?: number;
    maxDepth?: number;
    includeNeutralEvidence?: boolean;
    includeBinary?: boolean;
    applyDefaultExclusions?: boolean;
    /**
     * Compatibility mode for finite package-owned trees. Audit and discovery callers must leave
     * this false so budget exhaustion remains structured instead of throwing.
     */
    throwOnPartial?: boolean;
};
export declare function inventoryRepository(rootInput: string, options?: RepositoryInventoryOptions): Promise<RepositoryInventory>;
export declare function walkRepositoryPaths(rootInput: string, options?: RepositoryInventoryOptions): Promise<RepositoryInventory>;
export declare function parseInspectionBudget(value: string): number;
export declare function validateExclusionPattern(value: string, source?: string): string;
export declare function classifyInventoryPath(path: string): InventoryEvidenceClass;
export declare function renderInventoryIncomplete(diagnostics: RepositoryInventoryDiagnostics): string;
