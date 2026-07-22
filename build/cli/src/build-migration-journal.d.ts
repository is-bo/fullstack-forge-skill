export declare const BUILD_MIGRATION_PROJECT_REL = ".forge/build/project.json";
export declare const BUILD_MIGRATION_JOURNAL_REL = ".forge/build/migration-v1-to-v2.json";
export declare const BUILD_MIGRATION_BACKUP_REL = ".forge/build/.migration-v1-to-v2-backups";
export type BuildMigrationEntry = {
    rel: string;
    backup_rel: string;
    original_sha256: string;
    migrated_sha256: string;
    migrated_text: string;
};
export type BuildMigrationJournal = {
    schema_version: 1;
    kind: "build-v1-to-v2";
    status: "prepared" | "applying" | "complete" | "rolling_back" | "rolled_back";
    entries: BuildMigrationEntry[];
    applied: string[];
    restored: string[];
};
/** Validates the complete migration journal shape before any caller trusts its status. */
export declare function assertBuildMigrationJournal(value: unknown): asserts value is BuildMigrationJournal;
