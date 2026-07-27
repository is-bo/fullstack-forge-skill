import assert from "node:assert/strict";
import test from "node:test";
import { createReport, renderMarkdown, summarizeFindings } from "../src/report.js";
import { openFindingsGate } from "../src/gates.js";
import type { Finding, ProjectProfile, Severity, Status } from "../src/types.js";

/**
 * Status-aware aggregation.
 *
 * The defect these tests protect against: severity in this schema is *potential impact*, so an
 * analyzer may legitimately record CRITICAL severity with LOW confidence and `NOT_VERIFIED` status.
 * A severity-bucketed summary then reports that unproven possibility as a confirmed critical defect.
 *
 * The contract asserted here is that presentation separates the two axes. It is deliberately not a
 * relaxation: the same unverified critical must still block the Ship gate, and its status, severity,
 * and confidence must survive aggregation unchanged.
 */

const profile: ProjectProfile = {
  schema_version: 2,
  root: "/project",
  generated_at: "2026-07-27T00:00:00.000Z",
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

function finding(
  id: string,
  severity: Severity,
  status: Status,
  overrides: Partial<Finding> = {}
): Finding {
  return {
    id,
    section: "database",
    title: `Finding ${id}`,
    severity,
    confidence: status === "NOT_VERIFIED" ? "LOW" : "HIGH",
    status,
    location: [{ path: "src/workflow.ts", line: 4 }],
    evidence: ["Structural evidence recorded by the analyzer."],
    impact: "A partial failure leaves the record set inconsistent.",
    recommendation: "Execute the related writes inside one database transaction.",
    safe_fix: false,
    verification: ["Re-run the js-ts-database analyzer"],
    standards: ["CWE-662"],
    ...overrides
  };
}

/** The exact shape the transaction analyzer emits for an unresolvable boundary. */
const unverifiedCritical = finding(
  "FF-DATA-TRANSACTION-NOT-VERIFIED-001",
  "CRITICAL",
  "NOT_VERIFIED"
);
const confirmedHigh = finding("FF-DATA-TRANSACTION-001", "HIGH", "FAIL");

test("a CRITICAL, LOW-confidence NOT_VERIFIED finding is never counted as a confirmed defect", () => {
  const summary = summarizeFindings([unverifiedCritical, confirmedHigh]);
  assert.equal(
    summary.confirmed_critical,
    0,
    "an unverified finding must not reach the critical count"
  );
  assert.equal(summary.confirmed_defects, 1, "only the FAIL finding is a demonstrated defect");
  assert.equal(summary.confirmed_high, 1);
  assert.equal(
    summary.unverified_critical_or_high,
    1,
    "the gap must still be visible, just not as a defect"
  );
  assert.equal(summary.by_class.evidence_gap.by_severity.CRITICAL, 1);
  assert.equal(summary.by_class.confirmed.by_severity.CRITICAL, 0);
});

test("every status is aggregated into exactly one verdict class", () => {
  const findings = [
    finding("FF-A-001", "CRITICAL", "FAIL"),
    finding("FF-A-002", "MEDIUM", "WARNING"),
    finding("FF-A-003", "CRITICAL", "NOT_VERIFIED"),
    finding("FF-A-004", "HIGH", "BLOCKED"),
    finding("FF-A-005", "INFO", "PASS"),
    finding("FF-A-006", "INFO", "NOT_APPLICABLE"),
    finding("FF-A-007", "LOW", "SUPERSEDED")
  ];
  const summary = summarizeFindings(findings);
  assert.equal(summary.total, findings.length);
  const classified = Object.values(summary.by_class).reduce(
    (total, bucket) => total + bucket.total,
    0
  );
  assert.equal(classified, findings.length, "no finding may be dropped or double-counted");
  assert.equal(summary.by_class.confirmed.total, 2, "FAIL and WARNING are confirmed");
  assert.equal(
    summary.by_class.evidence_gap.total,
    2,
    "NOT_VERIFIED and BLOCKED are evidence gaps"
  );
  assert.equal(summary.by_class.passed.total, 1);
  assert.equal(summary.by_class.not_applicable.total, 1);
  assert.equal(summary.by_class.superseded.total, 1);
  assert.deepEqual(summary.by_class.evidence_gap.by_status, { NOT_VERIFIED: 1, BLOCKED: 1 });
});

test("the summary publishes no severity total that spans verdict classes", () => {
  const summary = summarizeFindings([unverifiedCritical, confirmedHigh]);
  assert.ok(
    !Object.prototype.hasOwnProperty.call(summary, "by_severity"),
    "a class-spanning severity rollup is exactly the number that must not exist"
  );
});

test("aggregation preserves severity, confidence, and status as potential impact and verdict", () => {
  const report = createReport("/project", profile, [unverifiedCritical], "database");
  const stored = report.findings.find((entry) => entry.id === unverifiedCritical.id);
  assert.ok(stored);
  assert.equal(
    stored.severity,
    "CRITICAL",
    "severity is potential impact and must not be downgraded"
  );
  assert.equal(stored.confidence, "LOW");
  assert.equal(
    stored.status,
    "NOT_VERIFIED",
    "the status contract must not be weakened to improve a score"
  );
});

test("the report carries a derived summary that agrees with its own findings", () => {
  const report = createReport("/project", profile, [unverifiedCritical, confirmedHigh], "database");
  assert.ok(report.summary);
  assert.equal(report.summary.confirmed_critical, 0);
  assert.equal(report.summary.confirmed_defects, 1);
  assert.equal(report.summary.total, report.findings.length);
  assert.deepEqual(report.summary, summarizeFindings(report.findings));
});

test("confirmed defects rank above unproven findings of higher potential impact", () => {
  const report = createReport("/project", profile, [unverifiedCritical, confirmedHigh], "database");
  assert.equal(
    report.findings[0]?.id,
    confirmedHigh.id,
    "an unverified CRITICAL must not head the list a reader skims as confirmed defects"
  );
  assert.equal(
    report.findings[1]?.id,
    unverifiedCritical.id,
    "nothing may be dropped from the list"
  );
});

test("the markdown report states severity inside its verdict class", () => {
  const report = createReport("/project", profile, [unverifiedCritical, confirmedHigh], "database");
  const markdown = renderMarkdown(report);
  assert.match(markdown, /## Severity by verdict/u);
  assert.match(markdown, /Confirmed defects: 1 \(CRITICAL 0, HIGH 1\)/u);
  assert.match(markdown, /potential impact is CRITICAL or HIGH: 1/u);
  assert.match(markdown, /Severity in this report is potential impact, not a verdict/u);
  assert.match(markdown, /NOT_VERIFIED: 1/u, "the status summary must remain intact");
});

test("markdown remediation and not-run sections stay on opposite sides of the verdict line", () => {
  const report = createReport("/project", profile, [unverifiedCritical, confirmedHigh], "database");
  const markdown = renderMarkdown(report);
  const remediation = markdown.slice(
    markdown.indexOf("## Prioritized remediation plan"),
    markdown.indexOf("## Execution ledger")
  );
  assert.ok(remediation.includes(confirmedHigh.id), "a confirmed defect belongs in remediation");
  assert.ok(
    !remediation.includes(unverifiedCritical.id),
    "an unverified finding must not appear as remediable confirmed work"
  );
  const notRun = markdown.slice(markdown.indexOf("## Checks not run or not verified"));
  assert.ok(
    notRun.includes(unverifiedCritical.id),
    "the gap must be named where gaps are reported"
  );
});

test("an empty report reports zero confirmed defects without claiming a pass", () => {
  const summary = summarizeFindings([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.confirmed_defects, 0);
  assert.equal(summary.unverified_critical_or_high, 0);
  const markdown = renderMarkdown(createReport("/project", profile, [], "database"));
  assert.match(markdown, /No findings were recorded\. This is not evidence of a pass\./u);
});

test("aggregation does not weaken the fail-closed Ship gate for unverified critical findings", () => {
  const gate = openFindingsGate([unverifiedCritical]);
  assert.equal(gate.status, "BLOCKED", "an unverified CRITICAL must still stop a release");
  const failing = openFindingsGate([confirmedHigh]);
  assert.equal(failing.status, "FAIL", "a confirmed HIGH must still fail the gate");
  assert.equal(openFindingsGate([]).status, "PASS");
});
