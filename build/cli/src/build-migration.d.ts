type MigrationEntry = {
    rel: string;
    backup_rel: string;
    original_sha256: string;
    migrated_sha256: string;
    migrated_text: string;
};
export type BuildMigrationPlan = {
    entries: Array<Pick<MigrationEntry, "rel" | "original_sha256" | "migrated_sha256">>;
    writes: string[];
};
export type BuildMigrationOptions = {
    dryRun?: boolean;
    resume?: boolean;
    rollback?: boolean;
    /** Test-only fault injection. Production callers must omit this option. */
    interruptAfter?: number;
};
/**
 * Plans or applies the v1-to-v2 Build migration. Inputs are fully parsed and validated before any
 * backup, journal, or target write occurs. A journal makes a partially applied migration resumable.
 */
export declare function migrateBuildState(root: string, options?: BuildMigrationOptions): Promise<BuildMigrationPlan>;
export declare function planBuildMigration(root: string): Promise<BuildMigrationPlan>;
export {};
