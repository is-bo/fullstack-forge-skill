import assert from "node:assert/strict";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { deriveBuildApplicability } from "../src/build-applicability.js";
import { evaluateBuildGates, planBuildGates } from "../src/build-gates.js";
import { deriveBuildRuntimeEvidence, planBuildRuntime } from "../src/build-runtime.js";
import { newFeature, reverifyEvidenceHashes, saveFeature } from "../src/build-state.js";
import { PACKAGE_ROOT } from "../src/constants.js";
import { sha256 } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
const CASES_PATH = join(PACKAGE_ROOT, "evals", "v030-prevention", "cases.json");
const EXPECTED_IDS = [
    "new-saas-app",
    "non-slop-dashboard",
    "registration-rbac",
    "secure-file-upload",
    "large-dataset-search",
    "justified-cache",
    "reject-unnecessary-redis",
    "tenant-scoped-feature",
    "third-party-webhook",
    "hostile-ai-invoice-extraction",
    "idempotent-background-job",
    "offline-capable-workflow"
];
const CLASSIFICATIONS = new Set([
    "deterministic",
    "nondeterministic",
    "human-required",
    "unsupported-external-tool"
]);
const STATUSES = new Set(["PASS", "NOT_VERIFIED", "BLOCKED"]);
const profile = {
    capabilities: { api: { name: "api", confidence: "HIGH", evidence: ["synthetic route"] } },
    capability_assessments: [],
    tenant_boundaries: [],
    databases: [],
    repository: { name: "v030-prevention", type: "repository", confidence: "HIGH", evidence: [] }
};
test("v0.3 prevention corpus has exactly the twelve public fixed tasks", async () => {
    const cases = await loadCases();
    assert.deepEqual(cases.map((entry) => entry.id), EXPECTED_IDS);
    assert.equal(new Set(cases.map((entry) => entry.id)).size, EXPECTED_IDS.length);
});
test("every prevention case is safe to materialize and classifies unavailable evidence honestly", async (t) => {
    for (const entry of await loadCases()) {
        await t.test(entry.id, async () => {
            assert.ok(entry.agent_task.length > 100, "agent task must be a fixed, material brief");
            assert.ok(entry.starting_repository.file_map.length > 0, "case must provide a file map");
            assert.ok(entry.expected_applicability.length > 0);
            assert.ok(entry.expected_gates.length > 0);
            assert.ok(entry.forbidden_defects.length >= 3);
            assert.ok(entry.required_validation_artifacts.length >= 3);
            assert.deepEqual(new Set(entry.checks.map((check) => check.classification)), CLASSIFICATIONS, "each case must distinguish local proof from unavailable evidence");
            for (const check of entry.checks) {
                assert.ok(STATUSES.has(check.status));
                if (check.classification === "deterministic")
                    assert.equal(check.status, "PASS");
                else
                    assert.notEqual(check.status, "PASS", `${check.id} cannot be represented as PASS`);
            }
            await withTemporaryProject(`v030-prevention-${entry.id}`, async (root) => {
                for (const file of entry.starting_repository.file_map) {
                    assert.equal(resolve(root, file.path).startsWith(`${resolve(root)}${sep}`), true);
                    const path = join(root, file.path);
                    await mkdir(join(path, ".."), { recursive: true });
                    await writeFile(path, file.content, "utf8");
                    assert.ok((await lstat(path)).isFile());
                    assert.equal(await readFile(path, "utf8"), file.content);
                }
            });
        });
    }
});
test("real applicability and gate exports prevent every declared missing-evidence shortcut", async (t) => {
    for (const entry of await loadCases()) {
        await t.test(entry.id, () => {
            const applicability = deriveBuildApplicability({
                profile,
                changed_paths: entry.starting_repository.file_map.map((file) => file.path),
                risk_baseline: "high"
            });
            for (const discipline of entry.machine_required)
                assert.ok(applicability.required.includes(discipline), `${entry.id}: ${discipline} must be required by exported applicability logic`);
            const plan = planBuildGates({
                tier: "high",
                commands: [],
                applicability: applicabilityFor(entry.expected_applicability),
                profile,
                runtime_available: false
            });
            for (const id of entry.expected_gates)
                assert.ok(plan.gates.some((gate) => gate.id === id), `${entry.id}: missing ${id}`);
            const evaluated = evaluateBuildGates(plan, []);
            for (const id of entry.expected_gates) {
                const gate = evaluated.find((candidate) => candidate.id === id);
                assert.ok(gate, `${entry.id}: ${id} must be evaluated`);
                assert.notEqual(gate.status, "PASS", `${entry.id}: missing evidence must not pass ${id}`);
                assert.ok(gate.missing.length > 0, `${entry.id}: ${id} must report missing evidence`);
            }
        });
    }
});
test("non-slop dashboard runtime evidence remains NOT_VERIFIED without complete captures", () => {
    const plan = planBuildRuntime({
        route: "http://127.0.0.1:3000/dashboard",
        role: "support-lead"
    });
    const rendered = {
        capture_status: "PARTIAL",
        status: "OK",
        url: "http://127.0.0.1:3000/dashboard",
        artifacts: [],
        viewports: [],
        console_errors: 0,
        limitations: ["No browser adapter is available to this offline corpus."]
    };
    const [runtime] = deriveBuildRuntimeEvidence({
        plan,
        rendered,
        cases: [],
        design_direction: { status: "PRESENT", follows_direction: true }
    });
    assert.equal(plan.cases.length, 24);
    assert.equal(runtime?.status, "NOT_VERIFIED");
});
test("reject-unnecessary-redis excludes an absent cache rather than inventing a cache pass", async () => {
    const entry = (await loadCases()).find((candidate) => candidate.id === "reject-unnecessary-redis");
    assert.ok(entry);
    const applicability = deriveBuildApplicability({
        profile,
        changed_paths: entry.starting_repository.file_map.map((file) => file.path),
        risk_baseline: "high"
    });
    const cache = applicability.decisions.find((decision) => decision.discipline === "cache");
    assert.equal(cache?.status, "EXCLUDED");
    assert.ok(!applicability.required.includes("cache"));
    const plan = planBuildGates({ tier: "high", commands: [], applicability, profile });
    assert.ok(!plan.gates.some((gate) => gate.id === "FF-BUILD-GATE-DISCIPLINE-CACHE"));
});
test("hostile AI input and stale evidence cannot become a PASS without the required artifacts", async () => {
    const entry = (await loadCases()).find((candidate) => candidate.id === "hostile-ai-invoice-extraction");
    assert.ok(entry);
    const plan = planBuildGates({
        tier: "high",
        commands: [],
        applicability: applicabilityFor(entry.expected_applicability),
        profile
    });
    const authorization = evaluateBuildGates(plan, []).find((gate) => gate.id === "FF-BUILD-GATE-AUTHORIZATION-NEGATIVE");
    assert.equal(authorization?.status, "NOT_VERIFIED");
    await withTemporaryProject("v030-hostile-ai-stale", async (root) => {
        const source = "export const validated = true;\n";
        await writeFile(join(root, "extractor.ts"), source, "utf8");
        const feature = newFeature("invoice-extraction", "high", "hostile invoice prevention");
        feature.evidence = [evidence("discipline:authorization", "extractor.ts", source)];
        await saveFeature(root, feature, false);
        await writeFile(join(root, "extractor.ts"), "export const validated = false;\n", "utf8");
        const reverified = await reverifyEvidenceHashes(root, feature);
        assert.deepEqual(reverified.demoted, ["discipline:authorization"]);
        assert.equal(reverified.feature.evidence[0]?.status, "NOT_VERIFIED");
    });
});
async function loadCases() {
    const value = JSON.parse(await readFile(CASES_PATH, "utf8"));
    assert.equal(typeof value, "object");
    assert.ok(value !== null && !Array.isArray(value));
    const corpus = value;
    assert.equal(corpus.schema_version, 1);
    assert.ok(Array.isArray(corpus.cases));
    return corpus.cases.map((entry) => assertCase(entry));
}
function assertCase(value) {
    assert.equal(typeof value, "object");
    assert.ok(value !== null && !Array.isArray(value));
    const entry = value;
    assert.ok(EXPECTED_IDS.includes(entry.id));
    assert.ok(Array.isArray(entry.checks));
    assert.ok(Array.isArray(entry.expected_gates));
    for (const file of entry.starting_repository.file_map) {
        assert.match(file.path, /^(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[a-zA-Z0-9._/-]+$/u);
        assert.ok(!file.path.includes(":"));
        assert.equal(typeof file.content, "string");
    }
    return entry;
}
function applicabilityFor(required) {
    return { decisions: [], required, suggested: [], unresolved: [], excluded: [] };
}
function evidence(criterion, path, source) {
    return {
        criterion,
        discipline: "authorization",
        security_control: true,
        status: "PASS",
        producer: "v030 prevention deterministic fixture",
        evidence: ["Synthetic hash re-verification assertion."],
        files: [{ path, sha256: sha256(source) }],
        instance_ids: [],
        recorded_at: "2026-07-21T12:00:00.000Z"
    };
}
