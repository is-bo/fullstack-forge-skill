import { lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { assertBuildFeature, assertBuildProject, assertNoInterruptedBuildMigration, BUILD_STATE_VERSION } from "./build-state.js";
import { assertNoSymlinkPath, resolveInside, sha256 } from "./utils.js";
const PROJECT_REL = ".forge/build/project.json";
const FEATURES_REL = ".forge/build/features";
const JOURNAL_REL = ".forge/build/migration-v1-to-v2.json";
const BACKUP_REL = ".forge/build/.migration-v1-to-v2-backups";
/**
 * Plans or applies the v1-to-v2 Build migration. Inputs are fully parsed and validated before any
 * backup, journal, or target write occurs. A journal makes a partially applied migration resumable.
 */
export async function migrateBuildState(root, options = {}) {
    if (options.resume && options.rollback)
        throw new Error("Build migration cannot resume and roll back in the same invocation.");
    const journal = await readJournalIfPresent(root);
    if (options.rollback)
        return rollback(root, journal, options.dryRun === true, options.interruptAfter);
    if (journal !== undefined && journal.status !== "complete" && journal.status !== "rolled_back") {
        if (!options.resume)
            throw new Error("A Build migration is interrupted. Run `forge migrate build --resume` or `forge migrate build --rollback`.");
        return journal.status === "rolling_back"
            ? rollback(root, journal, options.dryRun === true, options.interruptAfter)
            : resume(root, journal, options);
    }
    if (journal?.status === "complete")
        return planFromJournal(journal);
    return createAndApply(root, options);
}
export async function planBuildMigration(root) {
    const journal = await readJournalIfPresent(root);
    if (journal !== undefined && journal.status !== "rolled_back")
        return planFromJournal(journal);
    return planLegacy(root).then((entries) => ({
        entries: entries.map(({ rel, original_sha256, migrated_sha256 }) => ({
            rel,
            original_sha256,
            migrated_sha256
        })),
        writes: entries.map((entry) => entry.rel)
    }));
}
async function createAndApply(root, options) {
    const entries = await planLegacy(root);
    const plan = {
        entries: entries.map(({ rel, original_sha256, migrated_sha256 }) => ({
            rel,
            original_sha256,
            migrated_sha256
        })),
        writes: entries.map((entry) => entry.rel)
    };
    if (options.dryRun)
        return plan;
    await ensureSafeDirectory(root, BACKUP_REL);
    for (const entry of entries) {
        const source = resolveInside(root, entry.rel);
        const backup = resolveInside(root, entry.backup_rel);
        await assertRegularFile(root, source);
        const sourceBytes = await readFile(source);
        try {
            await atomicWriteBytes(root, backup, sourceBytes, true);
        }
        catch (error) {
            if (error.code !== "EEXIST")
                throw error;
            await assertRegularFile(root, backup);
            if (sha256(await readFile(backup)) !== sha256(sourceBytes))
                throw new Error(`Refusing to reuse a different Build migration backup for '${entry.rel}'.`, { cause: error });
        }
    }
    const journal = {
        schema_version: 1,
        kind: "build-v1-to-v2",
        status: "prepared",
        entries,
        applied: [],
        restored: []
    };
    await writeJournal(root, journal);
    return resume(root, journal, options);
}
async function resume(root, journal, options) {
    if (journal.status === "rolled_back")
        throw new Error("This Build migration was rolled back; plan it again.");
    journal.status = "applying";
    if (!options.dryRun)
        await writeJournal(root, journal);
    let appliedThisRun = 0;
    for (const entry of journal.entries) {
        const target = resolveInside(root, entry.rel);
        await assertRegularFile(root, target);
        const current = sha256(await readFile(target));
        if (current === entry.migrated_sha256) {
            if (!journal.applied.includes(entry.rel))
                journal.applied.push(entry.rel);
            continue;
        }
        if (current !== entry.original_sha256)
            throw new Error(`Cannot resume Build migration: '${entry.rel}' changed after planning.`);
        if (options.dryRun)
            continue;
        await atomicWriteBytes(root, target, Buffer.from(entry.migrated_text, "utf8"));
        journal.applied.push(entry.rel);
        await writeJournal(root, journal);
        appliedThisRun += 1;
        if (options.interruptAfter !== undefined && appliedThisRun >= options.interruptAfter)
            throw new Error("Injected Build migration interruption.");
    }
    if (!options.dryRun) {
        journal.status = "complete";
        await writeJournal(root, journal);
    }
    return planFromJournal(journal);
}
async function rollback(root, journal, dryRun, interruptAfter) {
    if (journal === undefined)
        throw new Error("No Build migration journal exists to roll back.");
    if (journal.status === "rolled_back")
        return planFromJournal(journal);
    if (journal.status !== "rolling_back")
        for (const entry of journal.entries) {
            const target = resolveInside(root, entry.rel);
            await assertRegularFile(root, target);
            const current = sha256(await readFile(target));
            if (current !== entry.original_sha256 && current !== entry.migrated_sha256)
                throw new Error(`Refusing rollback: '${entry.rel}' no longer matches an original or migrated byte hash.`);
            const backup = resolveInside(root, entry.backup_rel);
            await assertRegularFile(root, backup);
            if (sha256(await readFile(backup)) !== entry.original_sha256)
                throw new Error(`Refusing rollback: backup for '${entry.rel}' no longer matches its original byte hash.`);
        }
    if (!dryRun) {
        journal.status = "rolling_back";
        await writeJournal(root, journal);
        let restoredThisRun = 0;
        for (const entry of journal.entries) {
            const backup = resolveInside(root, entry.backup_rel);
            const target = resolveInside(root, entry.rel);
            const current = sha256(await readSafeFile(root, entry.rel));
            if (current === entry.original_sha256) {
                if (!journal.restored.includes(entry.rel)) {
                    journal.restored.push(entry.rel);
                    await writeJournal(root, journal);
                }
                continue;
            }
            if (current !== entry.migrated_sha256)
                throw new Error(`Refusing rollback: '${entry.rel}' changed during restoration.`);
            await assertRegularFile(root, backup);
            if (sha256(await readFile(backup)) !== entry.original_sha256)
                throw new Error(`Refusing rollback: backup for '${entry.rel}' changed during restoration.`);
            await atomicWriteBytes(root, target, await readFile(backup));
            journal.restored.push(entry.rel);
            await writeJournal(root, journal);
            restoredThisRun += 1;
            if (interruptAfter !== undefined && restoredThisRun >= interruptAfter)
                throw new Error("Injected Build rollback interruption.");
        }
        journal.status = "rolled_back";
        journal.applied = [];
        await writeJournal(root, journal);
    }
    return planFromJournal(journal);
}
async function planLegacy(root) {
    await assertNoInterruptedBuildMigration(root);
    const projectPath = resolveInside(root, PROJECT_REL);
    await assertRegularFile(root, projectPath);
    const files = [PROJECT_REL, ...(await listFeatureFiles(root))];
    const raw = await Promise.all(files.map(async (rel) => ({ rel, bytes: await readSafeFile(root, rel) })));
    const parsed = raw.map(({ rel, bytes }) => ({ rel, bytes, value: parseJson(rel, bytes) }));
    const project = parsed.find((entry) => entry.rel === PROJECT_REL);
    if (project === undefined)
        throw new Error("Build migration requires project state.");
    if (!isV1(project.value))
        throw new Error("Build project is not schema v1; mixed or unknown Build state is refused.");
    const migratedProject = migrateProject(project.value);
    const entries = [entryFor(PROJECT_REL, project.bytes, migratedProject)];
    for (const item of parsed.filter((entry) => entry.rel !== PROJECT_REL)) {
        if (!isV1(item.value))
            throw new Error(`Build state '${item.rel}' is mixed or has an unknown schema version.`);
        const feature = migrateFeature(item.value);
        const expectedSlug = item.rel.slice(`${FEATURES_REL}/`.length, -".json".length);
        if (feature.slug !== expectedSlug)
            throw new Error(`Feature state '${item.rel}' records a different slug '${feature.slug}'.`);
        entries.push(entryFor(item.rel, item.bytes, feature));
    }
    return entries;
}
function migrateProject(value) {
    const legacy = value;
    const updatedAt = typeof legacy.updated_at === "string" ? legacy.updated_at : "";
    const candidate = {
        ...legacy,
        schema_version: BUILD_STATE_VERSION,
        frame: {
            problem_statement: legacy.product?.summary ?? "",
            target_users: [],
            users_and_roles: [],
            desired_outcomes: [],
            business_rules: [],
            business_invariants: [],
            constraints: [],
            critical_workflows: [],
            sensitive_data_classes: [],
            trust_boundaries: [],
            expected_scale: "",
            stack_entries: Array.isArray(legacy.stack)
                ? legacy.stack.map((name) => {
                    if (typeof name !== "string")
                        throw new Error("Legacy Build stack entries must be strings.");
                    return { name, rationale: "" };
                })
                : [],
            assumptions: [],
            unresolved_decisions: [],
            initial_feature_backlog: [],
            design_direction_reference: ""
        },
        design_alignment: { status: "NOT_VERIFIED", references: [], recorded_at: updatedAt },
        selection_events: [],
        history: { migrated_from: 1, migrated_at: updatedAt }
    };
    assertBuildProject(candidate);
    return candidate;
}
function migrateFeature(value) {
    const legacy = value;
    const timestamp = typeof legacy.updated_at === "string" ? legacy.updated_at : "";
    const disciplines = Array.isArray(legacy.disciplines) ? legacy.disciplines : [];
    const evidence = Array.isArray(legacy.evidence)
        ? legacy.evidence.map((record) => ({
            ...record,
            status: "NOT_VERIFIED",
            migration_state: "migrated-untrusted",
            expired_at: timestamp
        }))
        : [];
    const acceptances = Array.isArray(legacy.risk_acceptances)
        ? legacy.risk_acceptances.map((record) => ({
            ...record,
            migration_state: "migrated-untrusted",
            lifecycle: "expired",
            expired_at: timestamp
        }))
        : [];
    const slug = typeof legacy.slug === "string" ? legacy.slug : "";
    const candidate = {
        ...legacy,
        schema_version: BUILD_STATE_VERSION,
        evidence,
        risk_acceptances: acceptances,
        evidence_run_ids: [],
        selection_events: disciplines.map((discipline, index) => ({
            id: `migration-${sha256(`${slug}:${index}`).slice(0, 32)}`,
            kind: "discipline",
            action: "selected",
            value: discipline.slug ?? "",
            reason: discipline.reason ?? "",
            recorded_at: timestamp,
            source: "migration"
        })),
        history: { migrated_from: 1, migrated_at: timestamp }
    };
    assertBuildFeature(candidate);
    return candidate;
}
function entryFor(rel, bytes, migrated) {
    const migrated_text = `${JSON.stringify(migrated, null, 2)}\n`;
    return {
        rel,
        backup_rel: `${BACKUP_REL}/${sha256(rel)}.bin`,
        original_sha256: sha256(bytes),
        migrated_sha256: sha256(migrated_text),
        migrated_text
    };
}
function isV1(value) {
    return (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        value.schema_version === 1);
}
async function listFeatureFiles(root) {
    const dir = resolveInside(root, FEATURES_REL);
    await assertNoSymlinkPath(root, dir);
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            if (entry.isSymbolicLink() ||
                !entry.isFile() ||
                !/^[a-z0-9][a-z0-9-]{0,63}\.json$/u.test(entry.name))
                throw new Error(`Unsafe or unknown Build feature state entry '${entry.name}'.`);
            files.push(`${FEATURES_REL}/${entry.name}`);
        }
        return files.sort();
    }
    catch (error) {
        if (error.code === "ENOENT")
            return [];
        throw error;
    }
}
async function readSafeFile(root, rel) {
    const path = resolveInside(root, rel);
    await assertRegularFile(root, path);
    return readFile(path);
}
async function assertRegularFile(root, path) {
    await assertNoSymlinkPath(root, path);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink())
        throw new Error(`Expected a regular Build state file: ${path}`);
}
async function ensureSafeDirectory(root, rel) {
    const path = resolveInside(root, rel);
    await assertNoSymlinkPath(root, path);
    await mkdir(path, { recursive: true });
    await assertNoSymlinkPath(root, path);
    if (!(await lstat(path)).isDirectory())
        throw new Error(`Expected a Build migration directory: ${path}`);
}
async function atomicWriteBytes(root, target, bytes, exclusive = false) {
    const temporary = join(dirname(target), `.${randomUUID()}.tmp`);
    await assertNoSymlinkPath(root, target);
    await assertNoSymlinkPath(root, temporary);
    if (exclusive) {
        try {
            await lstat(target);
            const exists = new Error(`Destination already exists: ${target}`);
            exists.code = "EEXIST";
            throw exists;
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
    }
    try {
        await writeFile(temporary, bytes, { flag: "wx" });
        await rename(temporary, target);
    }
    catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
}
async function readJournalIfPresent(root) {
    const path = resolveInside(root, JOURNAL_REL);
    await assertNoSymlinkPath(root, path);
    try {
        const bytes = await readFile(path);
        const value = parseJson(JOURNAL_REL, bytes);
        assertJournal(value);
        return value;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
async function writeJournal(root, journal) {
    assertJournal(journal);
    await atomicWriteBytes(root, resolveInside(root, JOURNAL_REL), Buffer.from(`${JSON.stringify(journal, null, 2)}\n`, "utf8"));
}
function assertJournal(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("Invalid Build migration journal.");
    const journal = value;
    const journalKeys = ["schema_version", "kind", "status", "entries", "applied", "restored"];
    if (Object.keys(journal).length !== journalKeys.length ||
        !Object.keys(journal).every((key) => journalKeys.includes(key)) ||
        journal.schema_version !== 1 ||
        journal.kind !== "build-v1-to-v2" ||
        !["prepared", "applying", "complete", "rolling_back", "rolled_back"].includes(journal.status) ||
        !Array.isArray(journal.entries) ||
        !Array.isArray(journal.applied) ||
        !Array.isArray(journal.restored))
        throw new Error("Invalid Build migration journal.");
    const seenTargets = new Set();
    for (const entry of journal.entries) {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry))
            throw new Error("Invalid Build migration journal entry.");
        const candidate = entry;
        const entryKeys = ["rel", "backup_rel", "original_sha256", "migrated_sha256", "migrated_text"];
        if (Object.keys(candidate).length !== entryKeys.length ||
            !Object.keys(candidate).every((key) => entryKeys.includes(key)))
            throw new Error("Invalid Build migration journal entry.");
        for (const key of entryKeys)
            if (typeof candidate[key] !== "string")
                throw new Error("Invalid Build migration journal entry.");
        const rel = String(candidate.rel);
        if (!isJournalTargetRelative(rel) ||
            seenTargets.has(rel) ||
            candidate.backup_rel !== `${BACKUP_REL}/${sha256(rel)}.bin` ||
            !/^[a-f0-9]{64}$/u.test(String(candidate.original_sha256)) ||
            !/^[a-f0-9]{64}$/u.test(String(candidate.migrated_sha256)) ||
            sha256(String(candidate.migrated_text)) !== candidate.migrated_sha256)
            throw new Error("Unsafe Build migration journal entry.");
        seenTargets.add(rel);
    }
    const entries = journal.entries;
    const applied = journal.applied;
    const restored = journal.restored;
    if (new Set(applied).size !== applied.length ||
        !applied.every((entry) => typeof entry === "string" && entries.some((item) => item.rel === entry)))
        throw new Error("Invalid Build migration journal applied list.");
    if (new Set(restored).size !== restored.length ||
        !restored.every((entry) => typeof entry === "string" && entries.some((item) => item.rel === entry)))
        throw new Error("Invalid Build migration journal restored list.");
}
function isJournalTargetRelative(rel) {
    return (rel === PROJECT_REL || /^\.forge\/build\/features\/[a-z0-9][a-z0-9-]{0,63}\.json$/u.test(rel));
}
function parseJson(rel, bytes) {
    try {
        return JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new Error(`Malformed Build state JSON: ${rel}`);
    }
}
function planFromJournal(journal) {
    return {
        entries: journal.entries.map(({ rel, original_sha256, migrated_sha256 }) => ({
            rel,
            original_sha256,
            migrated_sha256
        })),
        writes: journal.entries.map((entry) => entry.rel)
    };
}
//# sourceMappingURL=build-migration.js.map