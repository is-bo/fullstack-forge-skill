import assert from "node:assert/strict";
import test from "node:test";
import {
  featureSlugFromRequest,
  featureSlugWithCollision,
  menuChoiceToArgs,
  parseSimpleRoute,
  renderPlainFix,
  renderPlainReport,
  renderSimpleHelp,
  renderSimpleMenu,
  resolveAuditArea,
  suggestCommand
} from "../src/simple-cli.js";

test("simple command routing covers the public vocabulary", () => {
  assert.deepEqual(parseSimpleRoute(["build", "add", "customer", "login", "--json"]), {
    kind: "build",
    request: "add customer login",
    flags: ["--json"]
  });
  assert.deepEqual(parseSimpleRoute(["continue", "--root", "/project"]), {
    kind: "continue",
    flags: ["--root", "/project"]
  });
  assert.deepEqual(parseSimpleRoute(["audit"]), { kind: "default-audit", flags: [] });
  assert.deepEqual(parseSimpleRoute(["audit", "all"]), {
    kind: "expert",
    command: "audit",
    argv: ["all", "audit", "--scope", "full"]
  });
  assert.deepEqual(parseSimpleRoute(["fix"]), {
    kind: "expert",
    command: "fix",
    argv: ["all", "fix"]
  });
  assert.deepEqual(parseSimpleRoute(["verify", "security", "--details"]), {
    kind: "expert",
    command: "verify",
    argv: ["security", "verify", "--details"]
  });
  assert.deepEqual(parseSimpleRoute(["ship", "--allow-run"]), {
    kind: "expert",
    command: "ship",
    argv: ["ship", "--allow-run"]
  });
  assert.deepEqual(parseSimpleRoute(["status", "--json"]), {
    kind: "status",
    flags: ["--json"]
  });
  assert.deepEqual(parseSimpleRoute(["feature", "login"]), { kind: "none" });
});

test("audit areas resolve exact names and transparent natural-language aliases", () => {
  assert.equal(resolveAuditArea("security"), "security");
  assert.equal(resolveAuditArea("check customer login"), "auth");
  assert.equal(resolveAuditArea("user interface"), "ui");
  assert.equal(resolveAuditArea("everything"), "all");
  assert.throws(
    () => resolveAuditArea("uploads and file storage"),
    /storage, uploads|uploads, storage/iu
  );
  assert.throws(() => resolveAuditArea("CI"), /ambiguous.*deployment, supply-chain/iu);
  assert.throws(() => resolveAuditArea("securty"), /Did you mean 'security'/u);
});

test("natural-language feature IDs are safe, deterministic, redacted, and collision-capable", () => {
  assert.equal(featureSlugFromRequest("add customer login"), "customer-login");
  assert.equal(featureSlugFromRequest("add customer login"), "customer-login");
  assert.equal(featureSlugFromRequest("security"), "feature-security");
  const sensitive = featureSlugFromRequest(
    "add api_key=FixtureCredentialValue12345678901234567890 support"
  );
  assert.ok(!sensitive.includes("topsecret"));
  assert.match(sensitive, /^[a-z0-9][a-z0-9-]{0,63}$/u);
  const collision = featureSlugWithCollision("create customer login", "customer-login");
  assert.match(collision, /^customer-login-[a-f0-9]{8}$/u);
});

test("menu and help stay simple-first and cancellation is explicit", () => {
  assert.deepEqual(menuChoiceToArgs("1", "add search"), ["build", "add search"]);
  assert.deepEqual(menuChoiceToArgs("4"), ["audit", "all"]);
  assert.equal(menuChoiceToArgs("0"), undefined);
  assert.match(renderSimpleMenu(), /1\. Build something/u);
  assert.match(renderSimpleHelp(), /forge build "add customer login"/u);
  assert.match(renderSimpleHelp(), /missing evidence never becomes PASS/iu);
});

test("typos receive a bounded suggestion", () => {
  assert.equal(suggestCommand("autdit"), "forge audit");
  assert.equal(suggestCommand("biuld"), "forge build");
  assert.equal(suggestCommand("contnue"), "forge continue");
  assert.equal(suggestCommand("completely-unrelated"), undefined);
});

test("plain fix output distinguishes preview from application", () => {
  const result = {
    status: "BLOCKED" as const,
    dry_run: true,
    operations: [
      {
        fix_id: "safe-1",
        finding_id: "FF-TEST-001",
        section: "testing",
        risk: "safe" as const,
        path: "src/app.ts",
        expected_sha256: "a".repeat(64),
        resulting_sha256: "b".repeat(64),
        description: "Add a bounded assertion.",
        verification: "Run the focused test.",
        rollback: "Restore the original bytes."
      }
    ],
    changed_files: [],
    blocked_findings: [],
    execution: [],
    report_paths: []
  };
  const preview = renderPlainFix(result, false);
  assert.match(preview, /no files changed/u);
  assert.match(preview, /forge fix --safe/u);
});

test("plain report gives a nontechnical summary while keeping technical details in files", () => {
  const report = {
    schema_version: 2 as const,
    generated_at: "2026-07-22T00:00:00.000Z",
    root: "/project",
    scope: "frontend",
    profile: {
      schema_version: 2 as const,
      root: "/project",
      generated_at: "2026-07-22T00:00:00.000Z",
      detections: [],
      capabilities: {},
      repository: {
        name: "project",
        type: "repository",
        confidence: "HIGH" as const,
        evidence: []
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
      uploads: [],
      jobs: [],
      schedulers: [],
      realtime: [],
      caches: [],
      third_party_integrations: [],
      payments: [],
      notifications: [],
      analytics: [],
      ai: [],
      deployment: [],
      infrastructure: [],
      observability: [],
      test_commands: [],
      build_commands: [],
      lint_commands: [],
      typecheck_commands: []
    },
    findings: [
      {
        id: "FF-FRONTEND-BLANK-001",
        section: "frontend",
        title: "A new-tab link can control the original page",
        severity: "MEDIUM" as const,
        confidence: "HIGH" as const,
        status: "FAIL" as const,
        location: [{ path: "src/App.tsx", line: 4 }],
        evidence: ["A target=_blank link has no rel protection."],
        impact: "A page opened from this link may redirect the original application.",
        recommendation: "Add noopener and noreferrer.",
        safe_fix: true,
        verification: ["Re-run the frontend analyzer."],
        standards: []
      }
    ],
    execution: [],
    assumptions: [],
    residual_risk: [],
    gate_evidence: [],
    analyzer_coverage: [],
    tools: [],
    planned_checks: [],
    runtime_evidence: [],
    module_decisions: []
  } as unknown as Parameters<typeof renderPlainReport>[0];
  const output = renderPlainReport(report, "audit");
  assert.match(output, /Medium risk: A new-tab link/u);
  assert.match(output, /Why it matters: A page opened/u);
  assert.match(output, /Safe fix: available/u);
  assert.match(output, /Details: \.forge\/report\.md and \.forge\/report\.json/u);
});
