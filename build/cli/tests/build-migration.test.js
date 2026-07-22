import assert from "node:assert/strict";
import { mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { loadFeature, loadProject, newFeature, newProject } from "../src/build-state.js";
import { migrateBuildState, planBuildMigration } from "../src/build-migration.js";
import { withTemporaryProject } from "./helpers.js";
function v1Project() {
    const legacy = { ...newProject("legacy project", "standard") };
    delete legacy.frame;
    delete legacy.design_alignment;
    delete legacy.selection_events;
    delete legacy.history;
    legacy.stack = ["typescript"];
    legacy.schema_version = 1;
    return legacy;
}
function v1Feature(slug = "login") {
    const feature = newFeature(slug, "standard", "legacy feature");
    feature.disciplines = [{ slug: "security", reason: "legacy selected discipline" }];
    feature.evidence = [
        {
            criterion: "legacy-check",
            security_control: false,
            status: "PASS",
            producer: "legacy",
            evidence: ["old evidence"],
            files: [],
            instance_ids: [],
            recorded_at: feature.updated_at,
            not_applicable_reason: "legacy N/A"
        }
    ];
    feature.risk_acceptances = [
        { criterion: "legacy-risk", reason: "old", revision: "r1", timestamp: feature.updated_at }
    ];
    const legacy = { ...feature };
    delete legacy.evidence_run_ids;
    delete legacy.selection_events;
    delete legacy.history;
    legacy.schema_version = 1;
    return legacy;
}
async function writeV1(root, feature = v1Feature()) {
    const features = join(root, ".forge", "build", "features");
    await mkdir(features, { recursive: true });
    await writeFile(join(root, ".forge", "build", "project.json"), JSON.stringify(v1Project()), "utf8");
    await writeFile(join(features, "login.json"), JSON.stringify(feature), "utf8");
}
test("migrates v1 project and every feature without trusting old evidence or acceptance", async () => {
    await withTemporaryProject("build-migration", async (root) => {
        await writeV1(root);
        await migrateBuildState(root);
        const projectPath = join(root, ".forge", "build", "project.json");
        const migratedBytes = await readFile(projectPath);
        await migrateBuildState(root);
        assert.deepEqual(await readFile(projectPath), migratedBytes, "a completed migration is idempotent");
        const project = await loadProject(root);
        const feature = await loadFeature(root, "login");
        assert.ok(project);
        assert.ok(feature);
        assert.equal(project.schema_version, 2);
        assert.equal(project.frame.problem_statement, "legacy project");
        assert.deepEqual(project.frame.stack_entries, [{ name: "typescript", rationale: "" }]);
        assert.deepEqual(project.frame.users_and_roles, []);
        assert.equal(project.frame.design_direction_reference, "");
        assert.equal(feature.schema_version, 2);
        const legacyEvidence = feature.evidence[0];
        assert.ok(legacyEvidence);
        assert.equal(legacyEvidence.status, "NOT_VERIFIED");
        assert.equal(legacyEvidence.migration_state, "migrated-untrusted");
        assert.equal(feature.risk_acceptances[0]?.lifecycle, "expired");
        assert.equal(feature.selection_events[0]?.source, "migration");
    });
});
test("v1 loads require an explicit migration and dry runs preserve exact bytes", async () => {
    await withTemporaryProject("build-migration-dry", async (root) => {
        await writeV1(root);
        const projectPath = join(root, ".forge", "build", "project.json");
        const featurePath = join(root, ".forge", "build", "features", "login.json");
        const before = await Promise.all([readFile(projectPath), readFile(featurePath)]);
        await assert.rejects(loadProject(root), /must be migrated/u);
        const first = await migrateBuildState(root, { dryRun: true });
        const second = await planBuildMigration(root);
        assert.deepEqual(first, second);
        assert.deepEqual(await Promise.all([readFile(projectPath), readFile(featurePath)]), before);
    });
});
test("an interruption is resumable and blocks ordinary Build loads", async () => {
    await withTemporaryProject("build-migration-resume", async (root) => {
        await writeV1(root);
        await assert.rejects(migrateBuildState(root, { interruptAfter: 1 }), /Injected/u);
        await assert.rejects(loadProject(root), /interrupted/u);
        await migrateBuildState(root, { resume: true });
        assert.equal((await loadProject(root))?.schema_version, 2);
        assert.equal((await loadFeature(root, "login"))?.schema_version, 2);
    });
});
test("rollback restores exact source bytes and refuses changed migrated state", async () => {
    await withTemporaryProject("build-migration-rollback", async (root) => {
        await writeV1(root);
        const path = join(root, ".forge", "build", "project.json");
        const before = await readFile(path);
        await migrateBuildState(root);
        await migrateBuildState(root, { rollback: true });
        assert.deepEqual(await readFile(path), before);
        await migrateBuildState(root);
        await writeFile(path, `${await readFile(path, "utf8")}\n`, "utf8");
        await assert.rejects(migrateBuildState(root, { rollback: true }), /Refusing rollback/u);
    });
});
test("rollback completes an interrupted migration by preserving untouched original bytes", async () => {
    await withTemporaryProject("build-migration-partial-rollback", async (root) => {
        await writeV1(root);
        const projectPath = join(root, ".forge", "build", "project.json");
        const featurePath = join(root, ".forge", "build", "features", "login.json");
        const before = await Promise.all([readFile(projectPath), readFile(featurePath)]);
        await assert.rejects(migrateBuildState(root, { interruptAfter: 1 }), /Injected/u);
        await migrateBuildState(root, { rollback: true });
        assert.deepEqual(await Promise.all([readFile(projectPath), readFile(featurePath)]), before);
        await assert.rejects(loadProject(root), /must be migrated/u);
    });
});
test("an interrupted rollback blocks normal loads and resumes exact restoration", async () => {
    await withTemporaryProject("build-migration-rollback-resume", async (root) => {
        await writeV1(root);
        const projectPath = join(root, ".forge", "build", "project.json");
        const featurePath = join(root, ".forge", "build", "features", "login.json");
        const before = await Promise.all([readFile(projectPath), readFile(featurePath)]);
        await migrateBuildState(root);
        await assert.rejects(migrateBuildState(root, { rollback: true, interruptAfter: 1 }), /rollback interruption/u);
        await assert.rejects(loadProject(root), /interrupted/u);
        await migrateBuildState(root, { resume: true });
        assert.deepEqual(await Promise.all([readFile(projectPath), readFile(featurePath)]), before);
    });
});
test("interrupted migration rejects tampered state on both resume and rollback", async () => {
    await withTemporaryProject("build-migration-tamper", async (root) => {
        await writeV1(root);
        const projectPath = join(root, ".forge", "build", "project.json");
        await assert.rejects(migrateBuildState(root, { interruptAfter: 1 }), /Injected/u);
        await writeFile(projectPath, `${await readFile(projectPath, "utf8")}\n`, "utf8");
        await assert.rejects(migrateBuildState(root, { resume: true }), /changed/u);
        await assert.rejects(migrateBuildState(root, { rollback: true }), /Refusing rollback/u);
    });
});
test("migration journals reject unknown fields, forged backups, malformed hashes, and duplicates", async () => {
    await withTemporaryProject("build-migration-journal-tamper", async (root) => {
        await writeV1(root);
        await migrateBuildState(root);
        const journalPath = join(root, ".forge", "build", "migration-v1-to-v2.json");
        const baseline = JSON.parse(await readFile(journalPath, "utf8"));
        const first = baseline.entries[0];
        assert.ok(first);
        const mutations = [
            { ...structuredClone(baseline), unexpected: true },
            {
                ...structuredClone(baseline),
                entries: [{ ...first, unexpected: true }, ...baseline.entries.slice(1)]
            },
            {
                ...structuredClone(baseline),
                entries: [
                    {
                        ...first,
                        backup_rel: `.forge/build/.migration-v1-to-v2-backups/${"0".repeat(64)}.bin`
                    },
                    ...baseline.entries.slice(1)
                ]
            },
            {
                ...structuredClone(baseline),
                entries: [{ ...first, original_sha256: "not-a-hash" }, ...baseline.entries.slice(1)]
            },
            {
                ...structuredClone(baseline),
                entries: [first, first, ...baseline.entries.slice(1)]
            },
            {
                ...structuredClone(baseline),
                applied: [...baseline.applied, baseline.applied[0]]
            },
            {
                ...structuredClone(baseline),
                applied: []
            }
        ];
        for (const mutation of mutations) {
            await writeFile(journalPath, `${JSON.stringify(mutation, undefined, 2)}\n`, "utf8");
            await assert.rejects(migrateBuildState(root), /Invalid|Unsafe/u);
        }
        await assert.rejects(loadProject(root), /Invalid|Unsafe/u);
    });
});
test("malformed, unknown, mixed, and traversal-shaped state writes nothing", async () => {
    await withTemporaryProject("build-migration-refuse", async (root) => {
        await writeV1(root);
        const projectPath = join(root, ".forge", "build", "project.json");
        const before = await readFile(projectPath);
        await writeFile(join(root, ".forge", "build", "features", "other.json"), '{"schema_version":2}', "utf8");
        await assert.rejects(migrateBuildState(root), /mixed|Invalid build feature/u);
        assert.deepEqual(await readFile(projectPath), before);
        await writeFile(join(root, ".forge", "build", "features", "evil..json"), "{}", "utf8");
        await assert.rejects(migrateBuildState(root), /Unsafe or unknown/u);
    });
});
test("symlinked state is refused before migration writes", async () => {
    await withTemporaryProject("build-migration-symlink", async (root) => {
        await writeV1(root);
        const target = join(root, "outside.json");
        await writeFile(target, JSON.stringify(v1Feature()), "utf8");
        const link = join(root, ".forge", "build", "features", "login.json");
        await rename(link, join(root, "saved-login.json"));
        try {
            await symlink(target, link, "file");
        }
        catch (error) {
            if (error.code === "EPERM")
                return;
            throw error;
        }
        await assert.rejects(migrateBuildState(root), /symlink/u);
    });
});
//# sourceMappingURL=build-migration.test.js.map