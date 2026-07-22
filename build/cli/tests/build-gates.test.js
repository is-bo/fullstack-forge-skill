import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBuildGates, planBuildGates } from "../src/build-gates.js";
const profile = {
    databases: [],
    repository: { name: "test", type: "repository", confidence: "HIGH", evidence: [] }
};
const base = {
    decisions: [],
    required: [],
    suggested: [],
    unresolved: [],
    excluded: []
};
const commands = ["format:check", "lint", "typecheck", "test", "build"].map((name) => ({
    name,
    executable: "npm",
    args: ["run", name],
    source: "package.json",
    definition: `npm run ${name}`
}));
const evidence = (criterion, status = "PASS") => ({
    criterion,
    security_control: false,
    status,
    producer: "test",
    evidence: [],
    files: [],
    instance_ids: [],
    recorded_at: "2026-01-01T00:00:00.000Z"
});
test("light tier requires behavior evidence, not only static analysis", () => {
    const plan = planBuildGates({ tier: "light", commands, applicability: base, profile });
    assert.deepEqual(plan.gates.map((entry) => entry.id), [
        "FF-BUILD-GATE-APPLICABILITY",
        "FF-BUILD-GATE-BEHAVIOR",
        "FF-BUILD-GATE-PROJECT-TEST",
        "FF-BUILD-GATE-SCOPE",
        "FF-BUILD-GATE-STATIC"
    ]);
    const evaluated = evaluateBuildGates(plan, [
        evidence("applicability"),
        evidence("scope-resolution"),
        evidence("supported-static-patterns"),
        evidence("project:test")
    ]);
    const behavior = evaluated.find((entry) => entry.id === "FF-BUILD-GATE-BEHAVIOR");
    if (behavior === undefined)
        throw new Error("behavior gate unexpectedly missing");
    assert.equal(behavior.status, "NOT_VERIFIED");
    assert.match(behavior.missing.join(" "), /behavior-verification/u);
});
test("standard requires each detected project command and reports its actionable id", () => {
    const plan = planBuildGates({ tier: "standard", commands, applicability: base, profile });
    for (const name of ["FORMAT-CHECK", "LINT", "TYPECHECK", "TEST", "BUILD"])
        assert.ok(plan.gates.some((entry) => entry.id === `FF-BUILD-GATE-PROJECT-${name}`));
    const evaluated = evaluateBuildGates(plan, [
        evidence("scope-resolution"),
        evidence("supported-static-patterns"),
        evidence("behavior-verification"),
        evidence("project:test", "FAIL")
    ]);
    const testGate = evaluated.find((entry) => entry.id === "FF-BUILD-GATE-PROJECT-TEST");
    if (testGate === undefined)
        throw new Error("project test gate unexpectedly missing");
    assert.equal(testGate.status, "FAIL");
    assert.match(testGate.missing.join(" "), /project:test: FAIL/u);
});
test("each applicable discipline receives an explicit gate and required NOT_APPLICABLE stays closed", () => {
    const applicability = {
        ...base,
        required: ["api", "observability"]
    };
    const plan = planBuildGates({ tier: "standard", commands: [], applicability, profile });
    const api = plan.gates.find((entry) => entry.id === "FF-BUILD-GATE-DISCIPLINE-API");
    const observability = plan.gates.find((entry) => entry.id === "FF-BUILD-GATE-DISCIPLINE-OBSERVABILITY");
    assert.equal(api?.waiver_policy, "operational-human");
    assert.equal(observability?.waiver_policy, "operational-human");
    const evaluated = evaluateBuildGates(plan, [
        evidence("discipline:api", "NOT_APPLICABLE"),
        evidence("discipline:observability", "NOT_VERIFIED")
    ]);
    assert.equal(evaluated.find((entry) => entry.id === "FF-BUILD-GATE-DISCIPLINE-API")?.status, "NOT_VERIFIED");
    assert.equal(evaluated.find((entry) => entry.id === "FF-BUILD-GATE-DISCIPLINE-OBSERVABILITY")?.status, "NOT_VERIFIED");
});
test("high-risk gates are explicit and cannot be waived", () => {
    const applicability = {
        ...base,
        required: ["auth", "authorization", "tenancy", "uploads", "payments", "privacy", "ui"]
    };
    const plan = planBuildGates({
        tier: "high",
        commands: [],
        applicability,
        profile: { ...profile, databases: [{}] },
        runtime_available: false
    });
    for (const id of [
        "FF-BUILD-GATE-NEGATIVE-SECURITY",
        "FF-BUILD-GATE-AUTHENTICATION-NEGATIVE",
        "FF-BUILD-GATE-AUTHORIZATION-NEGATIVE",
        "FF-BUILD-GATE-TENANCY-ISOLATION",
        "FF-BUILD-GATE-UPLOAD-HOSTILE-FILE",
        "FF-BUILD-GATE-WEBHOOK-SAFETY",
        "FF-BUILD-GATE-MIGRATION",
        "FF-BUILD-GATE-MIGRATION-RECOVERY",
        "FF-BUILD-GATE-PRIVACY-DATA-FLOW",
        "FF-BUILD-GATE-INTEGRATION",
        "FF-BUILD-GATE-RUNTIME",
        "FF-BUILD-GATE-SECURITY-REVIEW"
    ])
        assert.ok(plan.gates.some((entry) => entry.id === id));
    const evaluated = evaluateBuildGates(plan, [], ["security-negative-tests"]);
    assert.equal(evaluated.find((entry) => entry.id === "FF-BUILD-GATE-NEGATIVE-SECURITY")?.status, "NOT_VERIFIED");
    assert.ok(plan.gates.every((entry) => entry.waiver_policy === "never"));
});
//# sourceMappingURL=build-gates.test.js.map