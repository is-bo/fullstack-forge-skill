import assert from "node:assert/strict";
import test from "node:test";
import { createReport, renderMarkdown } from "../src/report.js";
import type { Finding, ProjectProfile } from "../src/types.js";

const profile: ProjectProfile = {
  schema_version: 1,
  root: "/project",
  generated_at: "2026-07-18T00:00:00.000Z",
  detections: [],
  capabilities: {}
};
const base: Finding = {
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
  const report = createReport(
    "/project",
    profile,
    [
      base,
      {
        ...base,
        id: "FF-SEC-009",
        location: [{ path: "src/b.ts", line: 9 }],
        evidence: ["A second call reaches the same cause."]
      }
    ],
    "test"
  );
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
