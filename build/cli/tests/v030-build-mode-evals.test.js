import assert from "node:assert/strict";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { evaluateBuildGates, planBuildGates } from "../src/build-gates.js";
import { migrateBuildState } from "../src/build-migration.js";
import { loadFeature, loadProject, newFeature, newProject, reverifyEvidenceHashes, saveFeature } from "../src/build-state.js";
import { BUILD_RUNTIME_STATES, BUILD_RUNTIME_VIEWPORTS, deriveBuildRuntimeEvidence, planBuildRuntime } from "../src/build-runtime.js";
import { executeBuildProducer } from "../src/build-producers.js";
import { PACKAGE_ROOT } from "../src/constants.js";
import { sha256 } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
const FIXTURE_DIR = join(PACKAGE_ROOT, "evals", "v030-build-mode", "fixtures");
const EXPECTED_IDS = [
    "basic-executable-change",
    "ui-runtime-matrix",
    "auth-authorization",
    "tenancy",
    "uploads",
    "payments-webhooks",
    "database-migration-recovery",
    "privacy",
    "integrations-blocked",
    "failed-producer",
    "stale-forged-evidence",
    "v1-v2-rollback"
];
const EXPECTED_STATUSES = new Set(["PASS", "FAIL", "BLOCKED", "NOT_VERIFIED"]);
const FIXTURE_KINDS = new Set([
    "producer-pass",
    "ui-runtime-matrix",
    "required-gate",
    "migration-gates",
    "producer-blocked",
    "producer-failure",
    "stale-forged-evidence",
    "migration-rollback"
]);
const emptyApplicability = {
    decisions: [],
    required: [],
    suggested: [],
    unresolved: [],
    excluded: []
};
const profile = {
    databases: [],
    repository: { name: "v030-eval", type: "repository", confidence: "HIGH", evidence: [] }
};
const manifest = [{ path: "src/feature.ts", sha256: "a".repeat(64) }];
const fixedNow = () => "2026-07-21T12:00:00.000Z";
/**
 * This corpus treats fixture values only as data. It never runs fixture-provided commands, source
 * code, URLs, or instructions; the switch is a code-owned allowlist of stable Build exports. Each
 * synthetic command uses a mocked runner, so this test opens no network connection.
 */
test("v0.3 Build-mode corpus is public, deterministic, and has the exact twelve fixtures", async () => {
    const fixtures = await loadFixtures();
    assert.deepEqual(fixtures.map((fixture) => fixture.id), EXPECTED_IDS);
    assert.deepEqual(new Set(fixtures.map((fixture) => fixture.expected_status)), EXPECTED_STATUSES);
});
test("v0.3 Build-mode corpus asserts each declared outcome without network access", async (t) => {
    for (const fixture of await loadFixtures()) {
        await t.test(fixture.id, async () => {
            const actual = await runFixture(fixture);
            assert.equal(actual, fixture.expected_status, `${fixture.id} must preserve its declared status`);
        });
    }
});
async function loadFixtures() {
    const entries = await readdir(FIXTURE_DIR, { withFileTypes: true });
    const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();
    assert.equal(entries.length, files.length, "v0.3 corpus fixtures must be regular JSON files only");
    assert.equal(files.length, EXPECTED_IDS.length);
    const fixtures = [];
    for (const file of files) {
        assert.match(file, /^\d\d-[a-z0-9-]+\.json$/u);
        const path = join(FIXTURE_DIR, file);
        assert.ok((await lstat(path)).isFile(), `${file} must not be a symlink`);
        const raw = await readFile(path, "utf8");
        assert.ok(!raw.includes("://"), `${file} must not depend on a network URL`);
        const value = JSON.parse(raw);
        assertFixture(value, file);
        fixtures.push(value);
    }
    return fixtures;
}
function assertFixture(value, file) {
    assert.equal(typeof value, "object", `${file} must contain an object`);
    assert.ok(value !== null && !Array.isArray(value), `${file} must contain a non-array object`);
    const fixture = value;
    const allowed = new Set([
        "schema_version",
        "id",
        "title",
        "kind",
        "expected_status",
        "task",
        "disciplines",
        "gate_id"
    ]);
    for (const key of Object.keys(fixture))
        assert.ok(allowed.has(key), `${file} has unknown key '${key}'`);
    assert.equal(fixture.schema_version, 1, `${file} must use schema version 1`);
    assert.ok(typeof fixture.id === "string" && EXPECTED_IDS.includes(fixture.id));
    assert.ok(typeof fixture.title === "string" && fixture.title.length > 12);
    assert.ok(typeof fixture.kind === "string" && FIXTURE_KINDS.has(fixture.kind));
    assert.ok(typeof fixture.expected_status === "string" && EXPECTED_STATUSES.has(fixture.expected_status), `${file} must declare an asserted outcome`);
    assert.ok(typeof fixture.task === "string" && fixture.task.length > 30);
    if (fixture.disciplines !== undefined) {
        assert.ok(Array.isArray(fixture.disciplines) &&
            fixture.disciplines.every((item) => typeof item === "string"));
    }
    if (fixture.gate_id !== undefined) {
        const gateId = fixture.gate_id;
        if (typeof gateId !== "string")
            assert.fail(`${file} gate_id must be a string`);
        assert.match(gateId, /^FF-BUILD-GATE-/u);
    }
}
async function runFixture(fixture) {
    switch (fixture.kind) {
        case "producer-pass":
            return producerStatus("test", "behavior-verification", 0, true);
        case "ui-runtime-matrix":
            return uiRuntimeMatrixStatus();
        case "required-gate":
            return requiredGateStatus(fixture);
        case "migration-gates":
            return migrationGatesStatus();
        case "producer-blocked":
            return producerStatus("test:integration", "integration-verification", 0, false);
        case "producer-failure":
            return producerStatus("test:payments", "discipline:payments", 23, true);
        case "stale-forged-evidence":
            return staleAndForgedEvidenceStatus();
        case "migration-rollback":
            return migrationRollbackStatus();
        default:
            throw new Error(`Unsupported v0.3 fixture kind '${fixture.kind}'.`);
    }
}
async function producerStatus(name, criterion, exitCode, allowRun) {
    const observation = await executeBuildProducer({
        root: PACKAGE_ROOT,
        criterion,
        command: command(name),
        input_manifest: manifest,
        input_manifest_complete: true,
        allow_run: allowRun,
        offline: false,
        now: fixedNow,
        run_command: () => Promise.resolve({ exitCode, stdout: "synthetic output", stderr: "" })
    });
    if (!allowRun)
        assert.equal(observation.command.exit_code, undefined);
    return observation.status;
}
function command(name) {
    return {
        name,
        executable: process.execPath,
        args: ["--test"],
        source: "v030 synthetic fixture",
        definition: "node --test"
    };
}
function uiRuntimeMatrixStatus() {
    const plan = planBuildRuntime({
        route: "http://127.0.0.1:3000/dashboard",
        role: "member",
        states: BUILD_RUNTIME_STATES
    });
    assert.equal(plan.cases.length, BUILD_RUNTIME_STATES.length * BUILD_RUNTIME_VIEWPORTS.length);
    for (const state of BUILD_RUNTIME_STATES)
        assert.equal(plan.cases.filter((entry) => entry.state === state).length, BUILD_RUNTIME_VIEWPORTS.length);
    const rendered = {
        capture_status: "PARTIAL",
        status: "OK",
        url: "http://127.0.0.1:3000/dashboard",
        artifacts: [],
        viewports: [],
        console_errors: 0,
        limitations: ["Synthetic fixture intentionally has no rendered captures."]
    };
    return deriveBuildRuntimeEvidence({
        plan,
        rendered,
        cases: [],
        design_direction: { status: "PRESENT", follows_direction: true }
    })[0].status;
}
function requiredGateStatus(fixture) {
    assert.ok(fixture.disciplines && fixture.gate_id, `${fixture.id} requires gate configuration`);
    const plan = planBuildGates({
        tier: "high",
        commands: [],
        applicability: { ...emptyApplicability, required: fixture.disciplines },
        profile,
        runtime_available: false
    });
    const gate = evaluateBuildGates(plan, []).find((entry) => entry.id === fixture.gate_id);
    assert.ok(gate, `${fixture.id} must select an existing Build gate`);
    assert.ok(gate.missing.length > 0, `${fixture.id} must not hide missing evidence`);
    return gate.status;
}
function migrationGatesStatus() {
    const plan = planBuildGates({
        tier: "high",
        commands: [],
        applicability: { ...emptyApplicability, required: ["database"] },
        profile: { ...profile, databases: [{}] }
    });
    const evidence = [criterion("migration-validation"), criterion("migration-recovery")];
    const gates = evaluateBuildGates(plan, evidence).filter((entry) => entry.id === "FF-BUILD-GATE-MIGRATION" || entry.id === "FF-BUILD-GATE-MIGRATION-RECOVERY");
    assert.equal(gates.length, 2);
    assert.ok(gates.every((gate) => gate.status === "PASS"));
    return "PASS";
}
function criterion(name) {
    return {
        criterion: name,
        security_control: true,
        status: "PASS",
        producer: "v030 synthetic evidence",
        evidence: ["Synthetic deterministic assertion."],
        files: [],
        instance_ids: [],
        recorded_at: fixedNow()
    };
}
async function staleAndForgedEvidenceStatus() {
    return withTemporaryProject("v030-stale-forged", async (root) => {
        const path = join(root, "app.ts");
        await writeFile(path, "export const ready = true;\n", "utf8");
        const feature = newFeature("checkout", "high", "synthetic stale evidence");
        feature.disciplines = [{ slug: "payments", reason: "synthetic payment boundary" }];
        feature.evidence = [
            {
                ...criterion("supported-static-patterns"),
                files: [{ path: "app.ts", sha256: sha256("export const ready = true;\n") }]
            },
            {
                ...criterion("discipline:payments"),
                discipline: "payments",
                producer: "hand-edited"
            }
        ];
        await saveFeature(root, feature, false);
        await writeFile(path, "export const ready = false;\n", "utf8");
        const loaded = await loadFeature(root, "checkout");
        assert.ok(loaded);
        const reverified = await reverifyEvidenceHashes(root, loaded);
        assert.deepEqual(reverified.demoted.sort(), [
            "discipline:payments",
            "supported-static-patterns"
        ]);
        assert.equal(reverified.feature.evidence.length, 2, "demotion must preserve evidence records");
        assert.ok(reverified.feature.evidence.every((entry) => entry.status === "NOT_VERIFIED"));
        return "NOT_VERIFIED";
    });
}
async function migrationRollbackStatus() {
    return withTemporaryProject("v030-migration", async (root) => {
        const project = legacyProject();
        const feature = legacyFeature();
        const featureDir = join(root, ".forge", "build", "features");
        await mkdir(featureDir, { recursive: true });
        const projectPath = join(root, ".forge", "build", "project.json");
        const featurePath = join(featureDir, "login.json");
        await writeFile(projectPath, JSON.stringify(project), "utf8");
        await writeFile(featurePath, JSON.stringify(feature), "utf8");
        const before = await Promise.all([readFile(projectPath), readFile(featurePath)]);
        await migrateBuildState(root);
        assert.equal((await loadProject(root))?.schema_version, 2);
        assert.equal((await loadFeature(root, "login"))?.schema_version, 2);
        await migrateBuildState(root, { rollback: true });
        assert.deepEqual(await Promise.all([readFile(projectPath), readFile(featurePath)]), before);
        return "PASS";
    });
}
function legacyProject() {
    const project = { ...newProject("synthetic legacy project", "standard") };
    delete project.frame;
    delete project.design_alignment;
    delete project.selection_events;
    delete project.history;
    project.schema_version = 1;
    project.stack = ["typescript"];
    return project;
}
function legacyFeature() {
    const feature = newFeature("login", "standard", "synthetic legacy feature");
    const legacy = { ...feature };
    delete legacy.evidence_run_ids;
    delete legacy.selection_events;
    delete legacy.history;
    legacy.schema_version = 1;
    return legacy;
}
