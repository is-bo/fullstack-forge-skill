import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyCommandNetworkPolicy,
  decideCommandExecution,
  ledgerRecord,
  plannedCheckNetworkPolicy
} from "../src/offline-policy.js";
import { appendPlannedCheck, appendRuntimeEvidence, createPlannedCheck } from "../src/ledger.js";
import { migrateReport } from "../src/report.js";
import type { CommandDefinition, RuntimeEvidence } from "../src/types.js";

/**
 * Cross-feature regression tests spanning the v0.1.7 offline command policy and the v0.1.8 report
 * schema.
 *
 * These behaviours are each individually covered on their own branch. They are re-tested together
 * here because the failure mode being guarded against only appears at the seam: v0.1.8 introduces a
 * second, coarser network-policy vocabulary for the report, and the danger is that an arbitrary
 * audited-project command whose behaviour v0.1.7 refuses to guess is quietly re-described as
 * offline-safe on the way into the report.
 */

const arbitrary = (name: string, definition: string): CommandDefinition => ({
  name,
  executable: "npm",
  args: ["run", name],
  source: "package.json scripts",
  definition
});

const projectContext = { offline: true, forgeOwned: false };

test("a keyword-free arbitrary project script is UNKNOWN and blocked under --offline", () => {
  // No network keyword appears anywhere in this definition. That absence proves nothing.
  const command = arbitrary("build", "tsc -p tsconfig.json");

  assert.equal(classifyCommandNetworkPolicy(command, projectContext), "UNKNOWN");

  const decision = decideCommandExecution(command, projectContext);
  assert.equal(decision.permitted, false);
  assert.equal(decision.network_policy, "UNKNOWN");
  assert.equal(decision.sandbox, "none");
});

test("the absence of network keywords never downgrades a project command to OFFLINE_SAFE", () => {
  // Several definitions with no fetcher, installer, or URL token. All must stay UNKNOWN.
  for (const definition of [
    "tsc -p tsconfig.json",
    "node scripts/build.mjs",
    "eslint .",
    "make all",
    "cargo build --release"
  ]) {
    const policy = classifyCommandNetworkPolicy(arbitrary("task", definition), projectContext);
    assert.equal(policy, "UNKNOWN", `'${definition}' must remain UNKNOWN`);
    assert.notEqual(plannedCheckNetworkPolicy(policy), "OFFLINE_SAFE");
  }
});

test("a command's name never affects its classification", () => {
  // A script called 'verify:offline' says nothing about what it does.
  const misleading = arbitrary("verify:offline", "node scripts/whatever.mjs");
  assert.equal(classifyCommandNetworkPolicy(misleading, projectContext), "UNKNOWN");
  assert.equal(decideCommandExecution(misleading, projectContext).permitted, false);
});

test("plannedCheckNetworkPolicy never promotes UNKNOWN to OFFLINE_SAFE", () => {
  assert.equal(plannedCheckNetworkPolicy("UNKNOWN"), "UNKNOWN");
  assert.equal(plannedCheckNetworkPolicy("forge-internal-offline-safe"), "OFFLINE_SAFE");
  assert.equal(plannedCheckNetworkPolicy("cache-only-installation"), "OFFLINE_SAFE");
});

test("an UNKNOWN command reaches the planned-check ledger as UNKNOWN, not OFFLINE_SAFE", () => {
  const command = arbitrary("build", "tsc -p tsconfig.json");
  const decision = decideCommandExecution(command, projectContext);

  const check = createPlannedCheck({
    check_id: "project:build",
    module: "code",
    source: "package.json scripts",
    command: [command.executable, ...command.args],
    requires_authorization: true,
    network_policy: plannedCheckNetworkPolicy(decision.network_policy),
    status: "BLOCKED",
    reason: decision.reason
  });

  assert.equal(check.network_policy, "UNKNOWN");
  assert.equal(check.status, "BLOCKED");
});

test("a blocked command cannot be converted into PASS runtime evidence", () => {
  const command = arbitrary("e2e", "playwright test");
  const decision = decideCommandExecution(command, projectContext);
  assert.equal(decision.permitted, false);

  // The ledger record for a blocked command carries no exit code, so there is no result to
  // launder into a passing gate.
  const record = ledgerRecord(command, decision, "BLOCKED", true);
  assert.equal(record.disposition, "BLOCKED");
  assert.equal(record.exit_code, undefined);

  const evidence: RuntimeEvidence = {
    evidence_id: "runtime:e2e",
    evidence_type: "project-command",
    status: "BLOCKED",
    revision: "bb35a119d00103f64221033e406d9f5e5b9b344f",
    artifact_paths: [],
    hashes: [],
    limitations: [decision.reason]
  };

  // Honesty only ever decreases: a BLOCKED result may not later be rewritten as PASS.
  const ledger = appendRuntimeEvidence([], evidence);
  assert.throws(
    () => appendRuntimeEvidence(ledger, { ...evidence, status: "PASS" }),
    /cannot be re-recorded as PASS/u
  );
});

test("a blocked planned check cannot later be recorded as RUN", () => {
  const blocked = createPlannedCheck({
    check_id: "project:e2e",
    module: "testing",
    source: "package.json scripts",
    requires_authorization: true,
    network_policy: "UNKNOWN",
    status: "BLOCKED",
    reason: "Blocked by offline policy."
  });
  const ledger = appendPlannedCheck([], blocked);

  const promoted = createPlannedCheck({
    check_id: "project:e2e",
    module: "testing",
    source: "package.json scripts",
    requires_authorization: true,
    network_policy: "UNKNOWN",
    status: "RUN"
  });
  assert.throws(() => appendPlannedCheck(ledger, promoted), /BLOCKED|cannot|RUN/iu);
});

test("a not-run check is NOT_VERIFIED rather than BLOCKED when offline is not active", () => {
  // BLOCKED feeds the `forge fix` candidate set. A command that simply did not run must not
  // appear there, or `forge all fix --safe --allow-run` acquires work that was never blocked.
  const command = arbitrary("build", "tsc -p tsconfig.json");
  const decision = decideCommandExecution(command, { offline: false, forgeOwned: false });

  assert.equal(decision.permitted, true);
  assert.equal(decision.network_policy, "UNKNOWN");

  const record = ledgerRecord(command, decision, "NOT_RUN", false);
  assert.equal(record.disposition, "NOT_RUN");
  assert.notEqual(record.disposition, "BLOCKED");
});

test("a v0.1.7 report migrates without fabricating ledgers it never recorded", () => {
  // v0.1.7 changed no report field, so this is also the shape a v0.1.6 report has.
  const legacy = {
    schema_version: 1,
    generated_at: "2026-07-20T00:00:00.000Z",
    root: "/repo",
    revision: "bb35a119d00103f64221033e406d9f5e5b9b344f",
    environment: { platform: "linux", node: "22.0.0" },
    scope: "full",
    profile: { languages: ["typescript"], frameworks: [] },
    findings: [],
    execution: [{ command: ["npm", "test"], exitCode: 0, output: "ok" }],
    assumptions: [],
    residual_risk: [],
    gate_evidence: [],
    analyzer_coverage: []
  };

  const migrated = migrateReport(legacy);

  assert.equal(migrated.schema_version, 3);
  // Ledgers the writing release never tracked come back empty, never invented.
  assert.deepEqual(migrated.tools, []);
  assert.deepEqual(migrated.planned_checks, []);
  assert.deepEqual(migrated.runtime_evidence, []);
  assert.deepEqual(migrated.module_decisions, []);
  assert.deepEqual(migrated.compositions, []);

  // The v0.1.7 execution ledger survives migration untouched.
  assert.equal(migrated.execution.length, 1);
  assert.deepEqual(migrated.execution[0]?.command, ["npm", "test"]);

  assert.ok(migrated.migration);
  assert.equal(migrated.migration.from_schema_version, 1);
  assert.deepEqual(migrated.migration.absent_ledgers, [
    "tools",
    "planned_checks",
    "runtime_evidence",
    "module_decisions",
    "compositions"
  ]);

  // Emptiness must be stated as absence of tracking, not as evidence of success.
  const notes = migrated.migration.notes.join(" ");
  assert.match(notes, /not evidence that the corresponding checks ran or passed/u);
  assert.match(notes, /source file was not modified/u);
});

test("a v0.1.7 report is not claimed to be a v0.1.6 report", () => {
  // v0.1.7 altered no report field, so the two releases are genuinely indistinguishable here.
  // Naming only one of them would be fabricated precision.
  const migrated = migrateReport({
    schema_version: 1,
    generated_at: "2026-07-20T00:00:00.000Z",
    root: "/repo",
    environment: { platform: "linux", node: "22.0.0" },
    scope: "full",
    profile: { languages: [], frameworks: [] },
    findings: [],
    execution: [],
    assumptions: [],
    residual_risk: [],
    gate_evidence: [],
    analyzer_coverage: []
  });

  const origin = migrated.migration?.detected_origin ?? "";
  assert.match(origin, /v0\.1\.6-or-v0\.1\.7/u);
});
