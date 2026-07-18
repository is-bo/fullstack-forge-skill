import assert from "node:assert/strict";
import test from "node:test";
import { createReport, renderMarkdown } from "../src/report.js";
const profile = {
    schema_version: 2,
    root: "/project",
    generated_at: "2026-07-18T00:00:00.000Z",
    detections: [],
    capabilities: {},
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
const base = {
    id: "FF-SEC-002",
    section: "security",
    title: "Missing boundary",
    severity: "HIGH",
    confidence: "MEDIUM",
    status: "FAIL",
    location: [{ path: "src/a.ts", line: 2 }],
    evidence: ["Trace ends before the sink."],
    impact: "Input can reach an unchecked boundary.",
    recommendation: "Validate at the final sink.",
    safe_fix: false,
    verification: ["Run a negative boundary test."],
    standards: ["OWASP ASVS 5.0"]
};
test("reports merge duplicate causes and preserve locations", () => {
    const report = createReport("/project", profile, [
        base,
        {
            ...base,
            id: "FF-SEC-009",
            location: [{ path: "src/b.ts", line: 9 }],
            evidence: ["A second call reaches the same cause."]
        }
    ], "test");
    assert.equal(report.findings.length, 1);
    const first = report.findings[0];
    assert.ok(first);
    assert.equal(first.location.length, 2);
    assert.equal(first.evidence.length, 2);
    const markdown = renderMarkdown(report);
    assert.match(markdown, /FAIL: 1/u);
    assert.match(markdown, /src\/a\.ts:2/u);
    assert.match(markdown, /src\/b\.ts:9/u);
    assert.match(markdown, /Prioritized remediation plan/u);
    assert.match(markdown, /manual review or approval required/u);
});
test("reports preserve changed-scope merge-base and execution timing evidence", () => {
    const report = createReport("/project", profile, [], "changed", [
        {
            command: ["npm", "test"],
            exitCode: 0,
            output: "passed",
            started_at: "2026-07-18T00:00:00.000Z",
            duration_ms: 42
        }
    ], [], [], {
        repository_root: "/project",
        base_ref: "origin/main",
        base_commit: "a".repeat(40),
        merge_base: "b".repeat(40),
        changed_files: [{ path: "src/a.ts", status: "modified", sources: ["unstaged"] }],
        included_files: [{ path: "src/a.ts", reasons: ["changed (unstaged)"] }],
        excluded_applications: [],
        affected_applications: [],
        affected_modules: [{ section: "security", reasons: ["always applicable"] }]
    });
    assert.equal(report.scope_evidence?.merge_base, "b".repeat(40));
    assert.equal(report.execution[0]?.duration_ms, 42);
    const markdown = renderMarkdown(report);
    assert.match(markdown, /origin\/main/u);
    assert.match(markdown, /bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/u);
    assert.match(markdown, /42 ms/u);
});
//# sourceMappingURL=report.test.js.map