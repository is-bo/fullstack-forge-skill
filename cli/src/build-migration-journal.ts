import { sha256 } from "./utils.js";

export const BUILD_MIGRATION_PROJECT_REL = ".forge/build/project.json";
export const BUILD_MIGRATION_JOURNAL_REL = ".forge/build/migration-v1-to-v2.json";
export const BUILD_MIGRATION_BACKUP_REL = ".forge/build/.migration-v1-to-v2-backups";

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
export function assertBuildMigrationJournal(
  value: unknown
): asserts value is BuildMigrationJournal {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid Build migration journal.");
  const journal = value as Record<string, unknown>;
  const journalKeys = ["schema_version", "kind", "status", "entries", "applied", "restored"];
  if (
    Object.keys(journal).length !== journalKeys.length ||
    !Object.keys(journal).every((key) => journalKeys.includes(key)) ||
    journal.schema_version !== 1 ||
    journal.kind !== "build-v1-to-v2" ||
    !["prepared", "applying", "complete", "rolling_back", "rolled_back"].includes(
      journal.status as string
    ) ||
    !Array.isArray(journal.entries) ||
    !Array.isArray(journal.applied) ||
    !Array.isArray(journal.restored)
  )
    throw new Error("Invalid Build migration journal.");
  const seenTargets = new Set<string>();
  for (const entry of journal.entries) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      throw new Error("Invalid Build migration journal entry.");
    const candidate = entry as Record<string, unknown>;
    const entryKeys = ["rel", "backup_rel", "original_sha256", "migrated_sha256", "migrated_text"];
    if (
      Object.keys(candidate).length !== entryKeys.length ||
      !Object.keys(candidate).every((key) => entryKeys.includes(key))
    )
      throw new Error("Invalid Build migration journal entry.");
    for (const key of entryKeys)
      if (typeof candidate[key] !== "string")
        throw new Error("Invalid Build migration journal entry.");
    const rel = String(candidate.rel);
    if (
      !isJournalTargetRelative(rel) ||
      seenTargets.has(rel) ||
      candidate.backup_rel !== `${BUILD_MIGRATION_BACKUP_REL}/${sha256(rel)}.bin` ||
      !/^[a-f0-9]{64}$/u.test(String(candidate.original_sha256)) ||
      !/^[a-f0-9]{64}$/u.test(String(candidate.migrated_sha256)) ||
      sha256(String(candidate.migrated_text)) !== candidate.migrated_sha256
    )
      throw new Error("Unsafe Build migration journal entry.");
    seenTargets.add(rel);
  }
  if (!seenTargets.has(BUILD_MIGRATION_PROJECT_REL))
    throw new Error("Invalid Build migration journal: project state is missing.");
  const entries = journal.entries as BuildMigrationEntry[];
  const applied = journal.applied as unknown[];
  const restored = journal.restored as unknown[];
  if (
    new Set(applied).size !== applied.length ||
    !applied.every(
      (entry) => typeof entry === "string" && entries.some((item) => item.rel === entry)
    )
  )
    throw new Error("Invalid Build migration journal applied list.");
  if (
    new Set(restored).size !== restored.length ||
    !restored.every(
      (entry) => typeof entry === "string" && entries.some((item) => item.rel === entry)
    )
  )
    throw new Error("Invalid Build migration journal restored list.");
  const targets = entries.map((entry) => entry.rel);
  const appliedIsPrefix = applied.every((entry, index) => entry === targets[index]);
  const restoredIsPrefix = restored.every((entry, index) => entry === targets[index]);
  const completeSet = (items: unknown[]): boolean =>
    items.length === targets.length && items.every((entry, index) => entry === targets[index]);
  if (
    !appliedIsPrefix ||
    !restoredIsPrefix ||
    (journal.status === "prepared" && (applied.length > 0 || restored.length > 0)) ||
    (journal.status === "applying" && restored.length > 0) ||
    (journal.status === "complete" && (!completeSet(applied) || restored.length > 0)) ||
    (journal.status === "rolled_back" && (applied.length > 0 || !completeSet(restored)))
  )
    throw new Error("Invalid Build migration journal lifecycle state.");
}

function isJournalTargetRelative(rel: string): boolean {
  return (
    rel === BUILD_MIGRATION_PROJECT_REL ||
    /^\.forge\/build\/features\/[a-z0-9][a-z0-9-]{0,63}\.json$/u.test(rel)
  );
}
