import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ReportAuditLedger,
  buildAuditPlan,
  commandNetworkPolicy,
  orchestrateAudit,
  type AuditOrchestrationInput,
  type RuntimeEvidenceRecord
} from "../src/audit-orchestration.js";
import { classifyCommandNetworkPolicy } from "../src/offline-policy.js";
import { createReport } from "../src/report.js";
import type { CommandDefinition, ProjectProfile } from "../src/types.js";

/**
 * End-to-end regression tests spanning v0.1.7 (offline command policy), v0.1.8 (typed report
 * ledgers) and v0.1.9 (audit orchestration).
 *
 * Each release is covered on its own branch. These tests exist because the dangerous failures live
 * at the seam. v0.1.9 is the first release that decides, inside a normal audit, whether to execute
 * an audited project's own scripts. If its planning step were allowed to invent an `OFFLINE_SAFE`
 * verdict, it would silently undo the v0.1.7 policy while every single-branch test stayed green.
 */

const arbitrary = (name: string, definition: string): CommandDefinition => ({
  name,
  executable: "npm",
  args: ["run", name],
  source: "package.json scripts",
  definition
});

const profile = (root: string): ProjectProfile =>
  ({
    root,
    generated_at: "2026-07-20T00:00:00.000Z",
    languages: [],
    frameworks: [],
    package_managers: [],
    capabilities: [],
    entrypoints: [],
    evidence: []
  }) as unknown as ProjectProfile;

function input(overrides: Partial<AuditOrchestrationInput> = {}): AuditOrchestrationInput {
  return {
    root: "/tmp/project",
    modules: ["security"],
    commands: [arbitrary("lint", "eslint ."), arbitrary("test", "vitest run")],
    allowRun: false,
    offline: false,
    dryRun: false,
    ledger: new ReportAuditLedger(),
    ...overrides
  };
}

test("orchestration never invents OFFLINE_SAFE for an audited project's own scripts", () => {
  // Every definition below is keyword-free and would look harmless to a text scanner.
  for (const definition of ["eslint .", "vitest run", "tsc -p .", "node ./tools/check.js"]) {
    const command = arbitrary("check", definition);
    assert.equal(
      classifyCommandNetworkPolicy(command, { offline: true, forgeOwned: false }),
      "UNKNOWN"
    );
    assert.equal(commandNetworkPolicy(command, { offline: true, forgeOwned: false }), "UNKNOWN");
  }
  const plan = buildAuditPlan({
    modules: ["security"],
    commands: [arbitrary("lint", "eslint .")],
    policy: { offline: true, forgeOwned: false }
  });
  const lint = plan.find((check) => check.id === "command:lint");
  assert.ok(lint);
  assert.equal(lint.network_policy, "UNKNOWN");
  assert.equal(lint.requires_authorization, true);
});

test("keyword scanning may escalate to NETWORK_REQUIRED but never downgrades", () => {
  assert.equal(
    commandNetworkPolicy(arbitrary("deps", "npm audit"), { offline: true, forgeOwned: false }),
    "NETWORK_REQUIRED"
  );
  // Escalation is the only direction available: nothing here can reach OFFLINE_SAFE.
  const policies = ["eslint .", "npm audit", "curl https://example.test", "echo hi"].map(
    (definition) =>
      commandNetworkPolicy(arbitrary("c", definition), { offline: true, forgeOwned: false })
  );
  assert.equal(policies.includes("OFFLINE_SAFE"), false);
});

test("a blocked offline check never produces PASS gate evidence and stays out of the fix set", async () => {
  const ledger = new ReportAuditLedger("rev-1");
  const executed: string[] = [];
  const result = await orchestrateAudit(
    input({
      allowRun: true,
      offline: true,
      ledger,
      runCommand: (command) => {
        executed.push(command.name);
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
    })
  );
  assert.deepEqual(executed, [], "no arbitrary project command may execute under --offline");
  assert.deepEqual(result.execution, []);

  const checks = ledger
    .ledgers()
    .planned_checks.filter((check) => check.check_id.startsWith("command:"));
  assert.equal(checks.length, 2);
  for (const check of checks) {
    assert.equal(check.status, "BLOCKED");
    assert.equal(check.network_policy, "UNKNOWN");
    assert.ok((check.reason ?? "").length > 0, "a blocked check must carry a reason");
  }
  // A blocked check must never appear as passing evidence anywhere in the report.
  const report = createReport(
    "/tmp/project",
    profile("/tmp/project"),
    ledger.findings(),
    "security",
    result.execution,
    [],
    ledger.residualRisk(),
    undefined,
    [],
    [],
    "rev-1",
    undefined,
    ledger.ledgers()
  );
  assert.equal(
    report.findings.some((finding) => finding.status === "PASS"),
    false
  );
  assert.equal(
    report.planned_checks.every((check) => check.status !== "RUN"),
    true
  );
});

test("an unauthorized check is NOT_RUN, never BLOCKED, so `forge fix` cannot claim it", async () => {
  // BLOCKED feeds the `forge fix` candidate set. A check nobody authorized is not a defect.
  const ledger = new ReportAuditLedger();
  await orchestrateAudit(input({ allowRun: false, offline: false, ledger }));
  const checks = ledger
    .ledgers()
    .planned_checks.filter((check) => check.check_id.startsWith("command:"));
  assert.equal(checks.length, 2);
  for (const check of checks) assert.equal(check.status, "NOT_RUN");
  for (const finding of ledger.findings()) assert.notEqual(finding.status, "BLOCKED");
});

test("a normal audit stays static-only: nothing executes without --allow-run", async () => {
  const executed: string[] = [];
  const result = await orchestrateAudit(
    input({
      runCommand: (command) => {
        executed.push(command.name);
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
    })
  );
  assert.deepEqual(executed, []);
  assert.deepEqual(result.runtime_evidence, []);
  // Module inspection is the only thing a default audit performs.
  const ran = result.outcomes.filter((outcome) => outcome.status === "EXECUTED");
  assert.deepEqual(
    ran.map((outcome) => outcome.id),
    ["module:security"]
  );
});

test("rendered evidence integrates through the ledger without auto-starting servers", async () => {
  const ledger = new ReportAuditLedger("rev-2");
  let collectorInput: { allowRun: boolean; offline: boolean } | undefined;
  const evidence: RuntimeEvidenceRecord = {
    kind: "rendered-ui",
    status: "PASS",
    evidence_dir: ".forge/evidence",
    artifacts: [".forge/evidence/home.png"],
    limitations: [],
    complete: true
  };
  const result = await orchestrateAudit(
    input({
      allowRun: true,
      url: "http://127.0.0.1:3000",
      commands: [],
      ledger,
      collectRuntimeEvidence: (received) => {
        collectorInput = { allowRun: received.allowRun, offline: received.offline };
        return Promise.resolve(evidence);
      }
    })
  );
  // The operator supplies an already-running URL; orchestration never starts or installs anything.
  assert.equal(collectorInput?.allowRun, true);
  assert.equal(result.evidence_complete, true);
  const recorded = ledger.ledgers().runtime_evidence;
  assert.equal(recorded.length, 1);
  const first = recorded[0];
  assert.ok(first);
  assert.equal(first.status, "PASS");
  assert.equal(first.revision, "rev-2");
});

test("incomplete rendered evidence fails closed into the runtime-evidence ledger", async () => {
  const ledger = new ReportAuditLedger("rev-3");
  const result = await orchestrateAudit(
    input({
      allowRun: true,
      url: "http://127.0.0.1:3000",
      commands: [],
      ledger,
      collectRuntimeEvidence: () =>
        Promise.resolve({
          kind: "rendered-ui",
          status: "PARTIAL",
          artifacts: [],
          limitations: ["navigation timed out"],
          complete: false
        })
    })
  );
  assert.equal(result.evidence_complete, false, "requested-but-unproven evidence must fail closed");
  const recorded = ledger.ledgers().runtime_evidence[0];
  assert.ok(recorded);
  assert.equal(recorded.status, "NOT_VERIFIED");
  assert.ok(recorded.limitations.includes("navigation timed out"));
});

test("runtime evidence is refused under --offline rather than attempted", async () => {
  const ledger = new ReportAuditLedger();
  let called = false;
  const result = await orchestrateAudit(
    input({
      allowRun: true,
      offline: true,
      url: "http://127.0.0.1:3000",
      commands: [],
      ledger,
      collectRuntimeEvidence: () => {
        called = true;
        return Promise.resolve({
          kind: "rendered-ui",
          status: "PASS",
          artifacts: [],
          limitations: [],
          complete: true
        });
      }
    })
  );
  assert.equal(called, false);
  assert.equal(result.evidence_complete, false);
});

test("executed project commands are recorded as untrusted project-owned tools", async () => {
  const ledger = new ReportAuditLedger();
  await orchestrateAudit(
    input({
      allowRun: true,
      commands: [arbitrary("lint", "eslint .")],
      ledger,
      runCommand: () => Promise.resolve({ exitCode: 0, stdout: "ok", stderr: "" })
    })
  );
  const tool = ledger.ledgers().tools.find((entry) => entry.tool_id === "project-command:lint");
  assert.ok(tool);
  assert.equal(tool.ownership, "project-owned");
  assert.equal(tool.trust, "untrusted");
  assert.equal(tool.version_source, "unknown");
  const check = ledger.ledgers().planned_checks.find((entry) => entry.check_id === "command:lint");
  assert.equal(check?.status, "RUN");
});
