import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  REPORT_SCHEMA_VERSION,
  createReport,
  migrateReport,
  readReport,
  renderMarkdown,
  writeReport
} from "../src/report.js";
import type { Finding, ProjectProfile } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

const profile: ProjectProfile = {
  schema_version: 2,
  root: "/project",
  generated_at: "2026-07-19T00:00:00.000Z",
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

const finding: Finding = {
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

const HASH = "c".repeat(64);

/** Builds the report shape a given historical release would have written. */
function legacyReport(root: string, release: "v0.1.3" | "v0.1.4" | "v0.1.5" | "v0.1.6") {
  const legacyProfile = structuredClone(profile);
  legacyProfile.root = root;
  const base: Record<string, unknown> = {
    schema_version: 1,
    generated_at: "2026-07-18T00:00:00.000Z",
    root,
    scope: "security",
    profile: legacyProfile,
    findings: [structuredClone(finding)],
    execution: [],
    assumptions: ["Static inspection only."],
    residual_risk: ["Runtime behavior was not observed."]
  };
  if (release === "v0.1.3") return base;
  base.findings = [{ ...structuredClone(finding), instance_id: "FF-SEC-002:abcdef12" }];
  if (release === "v0.1.4") return base;
  base.gate_evidence = [];
  base.analyzer_coverage = [];
  if (release === "v0.1.5") return base;
  base.revision = "tree:deadbeef";
  base.environment = {
    operating_system: "linux 6.1",
    platform: "linux",
    architecture: "x64",
    node: "24.0.0",
    forge: "0.1.6",
    offline: true,
    allow_run: false
  };
  return base;
}

test("new reports are written at the current schema version with every ledger present", () => {
  const report = createReport("/project", profile, [finding], "security");
  assert.equal(report.schema_version, REPORT_SCHEMA_VERSION);
  assert.deepEqual(report.tools, []);
  assert.deepEqual(report.planned_checks, []);
  assert.deepEqual(report.runtime_evidence, []);
  assert.deepEqual(report.module_decisions, []);
  assert.equal(report.migration, undefined, "a natively written report was never migrated");
});

for (const release of ["v0.1.3", "v0.1.4", "v0.1.5", "v0.1.6"] as const) {
  test(`a ${release} report migrates without losing findings or fabricating ledgers`, async () => {
    await withTemporaryProject(`migrate-${release}`, async (root) => {
      const forge = join(root, ".forge");
      await mkdir(forge);
      const path = join(forge, "report.json");
      const original = legacyReport(root, release);
      await writeFile(path, JSON.stringify(original, null, 2), "utf8");

      const migrated = await readReport(root, path);
      assert.equal(migrated.schema_version, REPORT_SCHEMA_VERSION);

      // Existing evidence survives untouched.
      assert.equal(migrated.findings.length, 1);
      assert.equal(migrated.findings[0]?.id, "FF-SEC-002");
      assert.deepEqual(migrated.assumptions, ["Static inspection only."]);
      assert.deepEqual(migrated.residual_risk, ["Runtime behavior was not observed."]);

      // Legacy identity is preserved rather than regenerated.
      assert.equal(migrated.generated_at, "2026-07-18T00:00:00.000Z");
      assert.equal(migrated.root, root);
      assert.equal(migrated.scope, "security");
      assert.equal(migrated.revision, release === "v0.1.6" ? "tree:deadbeef" : undefined);

      // Absent ledgers stay empty and are named, never invented.
      assert.deepEqual(migrated.planned_checks, []);
      assert.deepEqual(migrated.runtime_evidence, []);
      assert.deepEqual(migrated.module_decisions, []);
      assert.deepEqual(migrated.tools, []);
      const migration = migrated.migration;
      assert.ok(migration, "a migrated report must record that it was migrated");
      assert.equal(migration.from_schema_version, 1);
      for (const ledger of ["tools", "planned_checks", "runtime_evidence", "module_decisions"])
        assert.ok(migration.absent_ledgers.includes(ledger), ledger);
      assert.ok(migration.detected_origin.includes(release));
      assert.ok(
        migration.notes.some((note) => note.includes("not evidence that")),
        "the report must say that an empty ledger does not imply a passing check"
      );

      // Migration is non-destructive: the source file is byte-identical afterwards.
      assert.equal(await readFile(path, "utf8"), JSON.stringify(original, null, 2));

      const markdown = renderMarkdown(migrated);
      assert.match(markdown, /## Schema and migration/u);
      assert.match(markdown, /Migrated from schema version 1/u);
      assert.match(markdown, /## Module applicability decisions/u);
    });
  });
}

test("a v0.1.5 migration states that the ledgers were absent, not that checks passed", async () => {
  await withTemporaryProject("migrate-absence-language", async (root) => {
    const forge = join(root, ".forge");
    await mkdir(forge);
    const path = join(forge, "report.json");
    await writeFile(path, JSON.stringify(legacyReport(root, "v0.1.5")), "utf8");
    const migrated = await readReport(root, path);
    const markdown = renderMarkdown(migrated);
    assert.match(markdown, /No planned checks were recorded\. This is not evidence/u);
    assert.match(markdown, /No runtime evidence was recorded/u);
    assert.match(markdown, /Module applicability is therefore unstated, not proven/u);
  });
});

test("JSON and Markdown stay synchronized across every new ledger", async () => {
  await withTemporaryProject("report-sync", async (root) => {
    const localProfile = structuredClone(profile);
    localProfile.root = root;
    const report = createReport(
      root,
      localProfile,
      [finding],
      "security",
      [],
      [],
      [],
      undefined,
      [],
      [],
      "tree:abc",
      undefined,
      {
        module_decisions: [
          {
            module: "ui",
            capability_status: "PRESENT",
            selection_status: "OUT_OF_CHANGED_SCOPE",
            reasons: ["No changed file reached this module."],
            evidence: ["app/page.tsx"]
          }
        ],
        planned_checks: [
          {
            check_id: "FF-CHK-UI-001",
            module: "ui",
            command: ["npx", "playwright", "test"],
            source: "forge-ui module procedure",
            status: "BLOCKED",
            reason: "Execution requires --allow-run.",
            requires_authorization: true,
            network_policy: "NETWORK_REQUIRED"
          }
        ],
        runtime_evidence: [
          {
            evidence_id: "EV-UI-001",
            evidence_type: "rendered-ui-capture",
            status: "NOT_VERIFIED",
            revision: "tree:abc",
            artifact_paths: [".forge/evidence/home.png"],
            hashes: [HASH],
            limitations: ["Only the mobile viewport was captured."]
          }
        ],
        tools: [
          {
            tool_id: "external:playwright",
            name: "Playwright",
            ownership: "external",
            trust: "untrusted",
            version: "unknown",
            version_source: "unknown",
            limitations: ["The browser build could not be identified."]
          }
        ]
      }
    );
    const [jsonPath, markdownPath] = await writeReport(report);
    assert.ok(jsonPath && markdownPath);
    const parsed = JSON.parse(await readFile(jsonPath, "utf8")) as typeof report;
    assert.equal(parsed.module_decisions.length, 1);
    assert.equal(parsed.planned_checks[0]?.status, "BLOCKED");
    assert.equal(parsed.runtime_evidence[0]?.status, "NOT_VERIFIED");
    assert.equal(parsed.tools[0]?.version_source, "unknown");

    const markdown = await readFile(markdownPath, "utf8");
    assert.match(markdown, /FF-CHK-UI-001/u);
    assert.match(markdown, /NETWORK_REQUIRED/u);
    assert.match(markdown, /authorization required: yes/u);
    assert.match(markdown, /EV-UI-001/u);
    assert.match(markdown, /Only the mobile viewport was captured/u);
    assert.match(markdown, /Playwright/u);
    assert.match(markdown, /version unknown \(unknown\)/u);
    assert.match(
      markdown,
      /NOT audited in this run — this is not evidence that the module is inapplicable/u
    );

    // The round trip through disk must not weaken any recorded status.
    const reread = await readReport(root, jsonPath);
    assert.equal(reread.planned_checks[0]?.status, "BLOCKED");
    assert.equal(reread.runtime_evidence[0]?.status, "NOT_VERIFIED");
  });
});

test("invalid ledger records are rejected on read", async () => {
  await withTemporaryProject("report-invalid-ledgers", async (root) => {
    const forge = join(root, ".forge");
    await mkdir(forge);
    const path = join(forge, "report.json");
    const valid = legacyReport(root, "v0.1.6");

    await writeFile(
      path,
      JSON.stringify({
        ...valid,
        runtime_evidence: [
          {
            evidence_id: "EV-1",
            evidence_type: "capture",
            status: "PASS",
            revision: "tree:abc",
            artifact_paths: ["../outside.png"],
            hashes: [HASH],
            limitations: []
          }
        ]
      }),
      "utf8"
    );
    await assert.rejects(readReport(root, path), /Invalid runtime evidence/u);

    await writeFile(
      path,
      JSON.stringify({
        ...valid,
        module_decisions: [
          {
            module: "ui",
            capability_status: "PRESENT",
            selection_status: "SOMETIMES",
            reasons: ["x"],
            evidence: []
          }
        ]
      }),
      "utf8"
    );
    await assert.rejects(readReport(root, path), /Invalid module decisions/u);

    await writeFile(
      path,
      JSON.stringify({
        ...valid,
        planned_checks: [
          {
            check_id: "FF-CHK-1",
            module: "ui",
            source: "manual",
            status: "NOT_RUN",
            requires_authorization: false,
            network_policy: "OFFLINE_SAFE"
          }
        ]
      }),
      "utf8"
    );
    await assert.rejects(readReport(root, path), /requires a reason/u);
  });
});

test("a report from a newer schema version is refused rather than misread", () => {
  assert.throws(
    () => migrateReport({ ...legacyReport("/project", "v0.1.6"), schema_version: 99 }),
    /newer than the supported version/u
  );
  assert.throws(() => migrateReport({ nonsense: true }), /Unsupported or invalid/u);
});
