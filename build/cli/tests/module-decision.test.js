import assert from "node:assert/strict";
import test from "node:test";
import { capabilityStatusFor, decideModules, decisionFindingStatus } from "../src/scope.js";
function profileWith(capabilities) {
    return {
        schema_version: 2,
        root: "/project",
        generated_at: "2026-07-19T00:00:00.000Z",
        detections: [],
        capabilities,
        repository: {
            name: "project",
            type: "git-repository",
            root: ".",
            confidence: "HIGH",
            evidence: ["test fixture"]
        },
        workspaces: [],
        applications: [],
        languages: [],
        frameworks: [],
        package_managers: [],
        databases: [],
        orms: [],
        authentication: [],
        sessions: [],
        authorization: [],
        roles: [],
        tenant_boundaries: [],
        routes: [],
        storage: [],
        upload_pipelines: [],
        caches: [],
        queues: [],
        scheduled_jobs: [],
        tests: [],
        ci: [],
        observability: [],
        integrations: [],
        ai_providers: [],
        payment_providers: [],
        hosting: [],
        deployment: [],
        environment_templates: [],
        critical_workflows: []
    };
}
function detection(evidence) {
    return { name: evidence, confidence: "HIGH", evidence: [evidence] };
}
function decisionFor(decisions, module) {
    const decision = decisions.find((candidate) => candidate.module === module);
    assert.ok(decision, `expected a decision for ${module}`);
    return decision;
}
const withFrontendAndPayments = profileWith({
    frontend: detection("app/page.tsx"),
    payments: detection("stripe client")
});
test("an absent bounded risk surface is the only case that yields NOT_APPLICABLE", () => {
    const decisions = decideModules({
        candidates: ["ui", "payments"],
        profile: withFrontendAndPayments,
        explicit: false
    });
    // 'uploads' is not in the candidate list here; use a module whose capability is truly missing.
    const absent = decideModules({
        candidates: ["uploads"],
        profile: withFrontendAndPayments,
        explicit: false
    });
    const uploads = decisionFor(absent, "uploads");
    assert.equal(uploads.capability_status, "ABSENT");
    assert.equal(uploads.selection_status, "NOT_REQUESTED");
    assert.equal(decisionFindingStatus(uploads), "NOT_APPLICABLE");
    assert.equal(decisionFor(decisions, "ui").capability_status, "PRESENT");
    assert.equal(decisionFindingStatus(decisionFor(decisions, "payments")), "SELECTED");
});
test("a present but unchanged capability is out of changed scope, never inapplicable", () => {
    const decisions = decideModules({
        candidates: ["ui", "payments"],
        profile: withFrontendAndPayments,
        explicit: false,
        changedModules: new Set(["payments"])
    });
    const ui = decisionFor(decisions, "ui");
    assert.equal(ui.capability_status, "PRESENT", "the frontend still exists");
    assert.equal(ui.selection_status, "OUT_OF_CHANGED_SCOPE");
    assert.equal(decisionFindingStatus(ui), "NOT_VERIFIED", "a module skipped because its files did not change is unaudited, not inapplicable");
    assert.notEqual(decisionFindingStatus(ui), "NOT_APPLICABLE");
    assert.equal(decisionFor(decisions, "payments").selection_status, "SELECTED");
});
test("an undetermined risk is APPLICABLE_UNPROVEN and runs proportionately", () => {
    const decisions = decideModules({
        candidates: ["payments"],
        profile: profileWith({}),
        explicit: false
    });
    const payments = decisionFor(decisions, "payments");
    assert.equal(payments.capability_status, "UNKNOWN");
    assert.equal(payments.risk_status, "UNKNOWN");
    assert.equal(payments.applicability_status, "APPLICABLE_UNPROVEN");
    assert.equal(payments.selection_status, "SELECTED");
    assert.equal(decisionFindingStatus(payments), "SELECTED");
});
test("a risk-filtered module records EXCLUDED_BY_RISK with its capability intact", () => {
    const decisions = decideModules({
        candidates: ["ui", "payments"],
        profile: withFrontendAndPayments,
        explicit: false,
        riskAllowed: new Set(["payments"]),
        riskLabel: "high"
    });
    const ui = decisionFor(decisions, "ui");
    assert.equal(ui.selection_status, "EXCLUDED_BY_RISK");
    assert.equal(ui.capability_status, "PRESENT");
    assert.equal(decisionFindingStatus(ui), "NOT_VERIFIED");
    assert.ok(ui.reasons.some((reason) => reason.includes("--risk high")));
});
test("an explicitly selected module is audited even when its capability is absent", () => {
    const decisions = decideModules({
        candidates: ["uploads"],
        profile: withFrontendAndPayments,
        explicit: true
    });
    const uploads = decisionFor(decisions, "uploads");
    assert.equal(uploads.selection_status, "SELECTED");
    assert.equal(uploads.explicitly_selected, true);
    assert.equal(uploads.capability_status, "ABSENT");
    assert.equal(decisionFindingStatus(uploads), "SELECTED");
});
test("an explicit request overrides both the risk filter and changed scope", () => {
    const decisions = decideModules({
        candidates: ["ui"],
        profile: withFrontendAndPayments,
        explicit: true,
        riskAllowed: new Set(),
        changedModules: new Set()
    });
    assert.equal(decisionFor(decisions, "ui").selection_status, "SELECTED");
});
test("a mixed monorepo separates absent, present-but-unchanged, and selected modules", () => {
    const monorepo = profileWith({
        frontend: detection("apps/web/page.tsx"),
        api: detection("apps/api/routes.ts"),
        database: detection("packages/db/schema.prisma")
    });
    const decisions = decideModules({
        candidates: ["ui", "api", "database", "payments"],
        profile: monorepo,
        explicit: false,
        changedModules: new Set(["api"])
    });
    assert.equal(decisionFor(decisions, "api").selection_status, "SELECTED");
    assert.equal(decisionFor(decisions, "ui").selection_status, "OUT_OF_CHANGED_SCOPE");
    assert.equal(decisionFor(decisions, "database").selection_status, "OUT_OF_CHANGED_SCOPE");
    // Only the module whose capability is genuinely missing may be called inapplicable.
    assert.equal(decisionFindingStatus(decisionFor(decisions, "payments")), "NOT_APPLICABLE");
    for (const module of ["ui", "database"])
        assert.notEqual(decisionFindingStatus(decisionFor(decisions, module)), "NOT_APPLICABLE");
});
test("changed files crossing several modules select every module they reach", () => {
    const monorepo = profileWith({
        frontend: detection("apps/web/page.tsx"),
        api: detection("apps/api/routes.ts"),
        database: detection("packages/db/schema.prisma")
    });
    const decisions = decideModules({
        candidates: ["ui", "api", "database", "queries"],
        profile: monorepo,
        explicit: false,
        changedModules: new Set(["api", "database", "queries"])
    });
    for (const module of ["api", "database", "queries"])
        assert.equal(decisionFor(decisions, module).selection_status, "SELECTED", module);
    assert.equal(decisionFor(decisions, "ui").selection_status, "OUT_OF_CHANGED_SCOPE");
});
test("decisions carry the discovery evidence behind each capability verdict", () => {
    const present = capabilityStatusFor("ui", withFrontendAndPayments);
    assert.equal(present.status, "PRESENT");
    assert.ok(present.evidence.join(" ").includes("app/page.tsx"));
    const absent = capabilityStatusFor("uploads", withFrontendAndPayments);
    assert.equal(absent.status, "ABSENT");
    assert.ok(absent.evidence.join(" ").includes("frontend"));
    const always = capabilityStatusFor("security", withFrontendAndPayments);
    assert.equal(always.status, "PRESENT", "always-applicable modules are never capability-gated");
});
test("both exclusion facts are preserved when risk and changed scope overlap", () => {
    const decisions = decideModules({
        candidates: ["ui"],
        profile: withFrontendAndPayments,
        explicit: false,
        riskAllowed: new Set(),
        riskLabel: "high",
        changedModules: new Set()
    });
    const ui = decisionFor(decisions, "ui");
    assert.equal(ui.selection_status, "EXCLUDED_BY_RISK");
    assert.ok(ui.reasons.some((reason) => reason.includes("changed file")), "the changed-scope fact must survive even when risk drives the status");
});
