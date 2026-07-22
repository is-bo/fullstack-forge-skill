import assert from "node:assert/strict";
import test from "node:test";
import { deriveBuildApplicability } from "../src/build-applicability.js";
function profile(capabilities = []) {
    const detected = Object.fromEntries(capabilities.map((name) => [name, { name, confidence: "HIGH", evidence: ["fixture"] }]));
    return {
        capabilities: detected,
        capability_assessments: [],
        authentication: [],
        authorization: [],
        tenant_boundaries: [],
        upload_pipelines: [],
        databases: [],
        caches: [],
        queues: [],
        scheduled_jobs: [],
        ai_providers: [],
        payment_providers: [],
        applications: [],
        languages: [],
        frameworks: [],
        package_managers: [],
        repository: { name: "test", type: "repository", confidence: "HIGH", evidence: [] },
        schema_version: 2,
        root: "/test",
        generated_at: "2026-01-01T00:00:00.000Z",
        detections: [],
        workspaces: [],
        orms: [],
        sessions: [],
        roles: [],
        routes: [],
        storage: [],
        tests: [],
        ci: [],
        observability: [],
        integrations: [],
        hosting: [],
        deployment: [],
        environment_templates: [],
        critical_workflows: []
    };
}
test("derives every requested mandatory omission discipline from executable changes", () => {
    const result = deriveBuildApplicability({
        profile: profile(),
        changed_paths: [
            "src/auth/login.ts",
            "src/policy/authorization.ts",
            "src/tenant/resource.ts",
            "src/upload/multer.ts",
            "src/payments/webhook.ts",
            "db/migrations/001.sql",
            "src/search/query.ts",
            "src/cache/redis.ts",
            "app/dashboard/page.tsx",
            "src/jobs/worker.ts",
            "src/ai/document-processor.ts",
            "src/routes/accounts.ts"
        ]
    });
    for (const discipline of [
        "auth",
        "authorization",
        "tenancy",
        "uploads",
        "payments",
        "database",
        "queries",
        "cache",
        "ui",
        "jobs",
        "ai",
        "code",
        "testing",
        "api"
    ])
        assert.ok(result.required.includes(discipline), `${discipline} must be required`);
    assert.ok(result.required.includes("security"));
    assert.ok(result.required.includes("accessibility"));
    assert.ok(result.required.includes("deployment"));
    assert.ok(result.required.includes("performance"));
    assert.ok(result.required.includes("privacy"));
});
test("a high project risk floor requires security without inventing an application capability", () => {
    const result = deriveBuildApplicability({
        profile: profile(),
        risk_baseline: "high",
        changed_paths: ["src/core/value.ts"]
    });
    assert.ok(result.required.includes("security"));
    assert.ok(result.required.includes("code"));
    assert.ok(result.required.includes("testing"));
    assert.ok(!result.required.includes("payments"));
});
test("documentation, test, fixture, and generated path signals cannot activate a discipline", () => {
    const result = deriveBuildApplicability({
        profile: profile(),
        changed_paths: [
            "docs/payments.md",
            "tests/auth/login.test.ts",
            "fixtures/uploads/sample.ts",
            ".agents/skills/payments/SKILL.md"
        ]
    });
    for (const discipline of ["auth", "uploads", "payments"])
        assert.ok(!result.required.includes(discipline), `${discipline} must not activate from non-production paths`);
});
test("a summary-only unsupported signal stays unresolved and direct ABSENT supports exclusion", () => {
    const ambiguous = deriveBuildApplicability({
        profile: profile(),
        summary: "consider a payment integration"
    });
    assert.ok(ambiguous.unresolved.includes("payments"));
    const excluded = deriveBuildApplicability({
        profile: profile(["authentication"]),
        changed_paths: ["src/core/value.ts"]
    });
    const uploads = excluded.decisions.find((entry) => entry.discipline === "uploads");
    if (uploads === undefined)
        throw new Error("uploads decision unexpectedly missing");
    assert.equal(uploads.status, "EXCLUDED");
    assert.match(uploads.exclusion_reason ?? "", /directly proved/u);
});
//# sourceMappingURL=build-applicability.test.js.map