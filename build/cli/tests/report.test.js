import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createReport, readReport, renderMarkdown } from "../src/report.js";
import { withTemporaryProject } from "./helpers.js";
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
test("v0.1.3 reports without instance or typed evidence fields remain readable", async () => {
    await withTemporaryProject("legacy-report-v013", async (root) => {
        const forge = join(root, ".forge");
        await mkdir(forge);
        const legacyProfile = structuredClone(profile);
        legacyProfile.root = root;
        const legacy = {
            schema_version: 1,
            generated_at: "2026-07-18T00:00:00.000Z",
            root,
            scope: "security",
            profile: legacyProfile,
            findings: [base],
            execution: [],
            assumptions: [],
            residual_risk: []
        };
        const path = join(forge, "report.json");
        await writeFile(path, JSON.stringify(legacy), "utf8");
        const migrated = await readReport(root, path);
        assert.equal(migrated.findings[0]?.instance_id, undefined);
        assert.deepEqual(migrated.gate_evidence, []);
        assert.deepEqual(migrated.analyzer_coverage, []);
    });
});
test("malformed typed gate and analyzer coverage records are rejected", async () => {
    await withTemporaryProject("invalid-typed-report", async (root) => {
        const forge = join(root, ".forge");
        await mkdir(forge);
        const invalidProfile = structuredClone(profile);
        invalidProfile.root = root;
        const report = createReport(root, invalidProfile, [base], "security", [], [], [], undefined, [
            {
                evidence_type: "secret-scan",
                producer: "test",
                scope: ["../outside"],
                timestamp: "not-a-date",
                revision: "tree:test",
                status: "PASS",
                relevant_instance_ids: [],
                absence_proves_success: true,
                limitations: ["bounded"]
            }
        ], [
            {
                status: "PASS",
                module: "security",
                language: "Python",
                framework: "unknown",
                analyzer_id: "none",
                coverage: "none",
                supported_shapes: [],
                unsupported_shapes: ["all shapes"]
            }
        ]);
        const path = join(forge, "report.json");
        await writeFile(path, JSON.stringify(report), "utf8");
        await assert.rejects(readReport(root, path), /Invalid typed gate evidence/u);
        report.gate_evidence = [];
        await writeFile(path, JSON.stringify(report), "utf8");
        await assert.rejects(readReport(root, path), /Invalid analyzer coverage/u);
    });
});
//# sourceMappingURL=report.test.js.map