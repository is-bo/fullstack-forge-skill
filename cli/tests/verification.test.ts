import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { runAnalyzers } from "../src/analyzers.js";
import { discoverProject } from "../src/discovery.js";
import { createReport, writeReport, type ReportLedgers } from "../src/report.js";
import type { Finding, GateEvidence } from "../src/types.js";
import { workingTreeRevision } from "../src/utils.js";
import { verifyFindings } from "../src/verification.js";
import { withTemporaryProject } from "./helpers.js";

test("finding-specific verification keeps unresolved findings failed", async () => {
  await withTemporaryProject("verify-unresolved", async (root) => {
    await writeFile(join(root, "server.ts"), sqlFixture, "utf8");
    const finding = await analyzerFinding(root, "security", "FF-SEC-SQL-001");
    const profile = await discoverProject(root);
    await writeReport(createReport(root, profile, [finding], "test audit"));
    const result = await verifyFindings(root, "security", profile, {
      allowRun: false,
      dryRun: false
    });
    const [verified] = result.report.findings;
    assert.ok(verified);
    assert.equal(verified.status, "FAIL");
    assert.ok(verified.evidence.some((item) => item.includes("reproduced")));
  });
});

test("finding-specific structural verification resolves a directly provable finding", async () => {
  await withTemporaryProject("verify-resolved", async (root) => {
    const path = join(root, "Link.tsx");
    await writeFile(
      path,
      'export const Link = () => <a href="/docs" target="_blank">Docs</a>;\n',
      "utf8"
    );
    const finding = await analyzerFinding(root, "frontend", "FF-FRONTEND-BLANK-001");
    const profile = await discoverProject(root);
    await writeReport(createReport(root, profile, [finding], "test audit"));
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace(
        'target="_blank"',
        'target="_blank" rel="noopener noreferrer"'
      ),
      "utf8"
    );
    const result = await verifyFindings(root, "frontend", profile, {
      allowRun: false,
      dryRun: false
    });
    assert.equal(result.report.findings[0]?.status, "PASS");
  });
});

test("a disappeared security pattern remains NOT_VERIFIED without behavior proof", async () => {
  await withTemporaryProject("verify-disappeared", async (root) => {
    const path = join(root, "server.ts");
    await writeFile(path, sqlFixture, "utf8");
    const finding = await analyzerFinding(root, "security", "FF-SEC-SQL-001");
    const profile = await discoverProject(root);
    await writeReport(createReport(root, profile, [finding], "test audit"));
    await writeFile(path, "export const queryRemoved = true;\n", "utf8");
    const result = await verifyFindings(root, "security", profile, {
      allowRun: false,
      dryRun: false
    });
    const [verified] = result.report.findings;
    assert.ok(verified);
    assert.equal(verified.status, "NOT_VERIFIED");
    assert.ok(verified.evidence.some((item) => item.includes("disappearance alone")));
  });
});

test("verification blocks an unapproved project command", async () => {
  await withTemporaryProject("verify-blocked", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "verify-command", private: true, scripts: { test: 'node -e "process.exit(0)"' } })}\n`,
      "utf8"
    );
    const profile = await discoverProject(root);
    const finding: Finding = {
      id: "FF-TEST-VERIFY-001",
      section: "testing",
      title: "Targeted regression test requires approval",
      severity: "HIGH",
      confidence: "HIGH",
      status: "FAIL",
      location: [{ path: "package.json", line: 1 }],
      evidence: ["The original audit requires a targeted project test."],
      impact: "Behavior remains unverified.",
      recommendation: "Run the reviewed targeted test.",
      safe_fix: false,
      verification: ["Run the detected test command."],
      standards: ["Fullstack Forge evidence protocol"],
      verification_plan: {
        actions: [{ type: "project-command", command: "test", required: true }]
      }
    };
    await writeReport(createReport(root, profile, [finding], "test audit"));
    const result = await verifyFindings(root, "testing", profile, {
      allowRun: false,
      dryRun: false
    });
    assert.equal(result.report.findings[0]?.status, "BLOCKED");
  });
});

test("offline verification blocks an unknown project command without spawning it", async () => {
  await withTemporaryProject("verify-offline-command", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({
        name: "verify-offline-command",
        private: true,
        scripts: {
          test: `node -e "require('node:fs').writeFileSync('offline-sentinel','ran')"`
        }
      })}\n`,
      "utf8"
    );
    const profile = await discoverProject(root);
    const finding: Finding = {
      id: "FF-TEST-OFFLINE-001",
      section: "testing",
      title: "Offline verification must not execute unknown project scripts",
      severity: "HIGH",
      confidence: "HIGH",
      status: "FAIL",
      location: [{ path: "package.json", line: 1 }],
      evidence: ["The original audit requires a targeted project test."],
      impact: "An unclassified script could access the network despite an offline claim.",
      recommendation: "Keep the command blocked while offline.",
      safe_fix: false,
      verification: ["Prove the command was blocked before process creation."],
      standards: ["Fullstack Forge offline execution policy"],
      verification_plan: {
        actions: [{ type: "project-command", command: "test", required: true }]
      }
    };
    await writeReport(createReport(root, profile, [finding], "test audit"));

    const result = await verifyFindings(root, "testing", profile, {
      allowRun: true,
      dryRun: false,
      offline: true,
      forgeOwned: false
    });
    assert.equal(result.report.findings[0]?.status, "BLOCKED");
    assert.deepEqual(result.report.execution, []);
    assert.deepEqual(
      result.command_ledger.map((record) => ({
        disposition: record.disposition,
        offline: record.offline,
        network_policy: record.network_policy
      })),
      [{ disposition: "BLOCKED", offline: true, network_policy: "UNKNOWN" }]
    );
    await assert.rejects(readFile(join(root, "offline-sentinel"), "utf8"), /ENOENT/u);
  });
});

test("verification detects a regressed finding that was previously marked PASS", async () => {
  await withTemporaryProject("verify-regressed", async (root) => {
    await writeFile(
      join(root, "Link.tsx"),
      'export const Link = () => <a href="/docs" target="_blank">Docs</a>;\n',
      "utf8"
    );
    const finding = await analyzerFinding(root, "frontend", "FF-FRONTEND-BLANK-001");
    finding.status = "PASS";
    finding.evidence.push("A prior structural verification passed before this regression.");
    const profile = await discoverProject(root);
    await writeReport(createReport(root, profile, [finding], "test audit"));
    const result = await verifyFindings(root, "frontend", profile, {
      allowRun: false,
      dryRun: false
    });
    assert.equal(result.report.findings[0]?.status, "FAIL");
  });
});

test("verification preserves typed gate evidence and analyzer coverage", async () => {
  await withTemporaryProject("verify-typed-evidence", async (root) => {
    await writeFile(join(root, "server.ts"), sqlFixture, "utf8");
    const finding = await analyzerFinding(root, "security", "FF-SEC-SQL-001");
    const profile = await discoverProject(root);
    const revision = await workingTreeRevision(root);
    const evidence: GateEvidence = {
      evidence_type: "secret-scan",
      producer: "test-secret-scan",
      scope: ["repository"],
      timestamp: new Date().toISOString(),
      revision,
      status: "PASS",
      relevant_instance_ids: [],
      absence_proves_success: true,
      limitations: ["Pattern scan only."]
    };
    await writeReport(
      createReport(
        root,
        profile,
        [finding],
        "test audit",
        [],
        [],
        [],
        undefined,
        [evidence],
        [
          {
            status: "PASS",
            module: "security",
            language: "JavaScript/TypeScript",
            framework: "any",
            analyzer_id: "js-ts-security",
            coverage: "executable",
            supported_shapes: ["local data flow"],
            unsupported_shapes: ["cross-file data flow"]
          }
        ],
        revision
      )
    );
    const result = await verifyFindings(root, "security", profile, {
      allowRun: false,
      dryRun: false
    });
    assert.deepEqual(result.report.gate_evidence, [evidence]);
    assert.equal(result.report.analyzer_coverage[0]?.analyzer_id, "js-ts-security");
    assert.equal(result.report.revision, revision);
  });
});

test("verification preserves report provenance ledgers and environment", async () => {
  await withTemporaryProject("verify-provenance", async (root) => {
    await writeFile(join(root, "server.ts"), sqlFixture, "utf8");
    const finding = await analyzerFinding(root, "security", "FF-SEC-SQL-001");
    const profile = await discoverProject(root);
    const revision = await workingTreeRevision(root);
    const ledgers: ReportLedgers = {
      tools: [
        {
          tool_id: "forge-test-analyzer",
          name: "Forge test analyzer",
          ownership: "forge-owned",
          trust: "trusted",
          version: "test",
          version_source: "declared",
          invocation: ["forge", "security", "audit"],
          limitations: ["Fixture-only provenance record."]
        }
      ],
      planned_checks: [
        {
          check_id: "forge-test-check",
          module: "security",
          command: ["forge", "security", "audit"],
          source: "verification fixture",
          status: "RUN",
          requires_authorization: false,
          network_policy: "OFFLINE_SAFE"
        }
      ],
      runtime_evidence: [
        {
          evidence_id: "forge-test-runtime",
          evidence_type: "fixture",
          status: "PASS",
          revision,
          artifact_paths: ["evidence.json"],
          hashes: [`sha256:${"0".repeat(64)}`],
          limitations: ["Synthetic fixture evidence."]
        }
      ],
      module_decisions: [
        {
          module: "security",
          risk_status: "PRESENT",
          control_status: "UNKNOWN",
          applicability_status: "APPLICABLE",
          analyzer_support: "EXECUTABLE",
          capability_status: "PRESENT",
          selection_status: "SELECTED",
          reasons: ["Explicit verification fixture."],
          evidence: ["server.ts"]
        }
      ],
      compositions: [
        {
          module: "security",
          mode: "forge-native",
          outputClassification: "finding",
          selected: [
            {
              tier: "forge-contract",
              provider: "fullstack-forge",
              skill: "forge-security",
              runtimePath: "src/fullstack-forge/modules/security.md",
              reason: "Forge retains finding authority."
            }
          ],
          suppressed: [],
          budget: { maxPrimarySkills: 1, maxOverlays: 1, maxSupplemental: 1 },
          conflicts: [],
          forgeAuthority: ["finding status"],
          missing: []
        }
      ]
    };
    const environment = {
      operating_system: "fixture-os",
      platform: "fixture-platform",
      architecture: "fixture-arch",
      node: "fixture-node",
      forge: "fixture-forge",
      offline: true,
      allow_run: false
    };
    await writeReport(
      createReport(
        root,
        profile,
        [finding],
        "test audit",
        [],
        [],
        [],
        undefined,
        [],
        [],
        revision,
        environment,
        ledgers
      )
    );

    const result = await verifyFindings(root, "security", profile, {
      allowRun: false,
      dryRun: false
    });
    assert.deepEqual(result.report.tools, ledgers.tools);
    assert.deepEqual(result.report.planned_checks, ledgers.planned_checks);
    assert.deepEqual(result.report.runtime_evidence, ledgers.runtime_evidence);
    assert.deepEqual(result.report.module_decisions, ledgers.module_decisions);
    assert.deepEqual(result.report.compositions, ledgers.compositions);
    assert.deepEqual(result.report.environment, environment);
  });
});

test("verification demotes a stale positive finding that it cannot recheck", async () => {
  await withTemporaryProject("verify-stale-pass", async (root) => {
    const source = join(root, "source.ts");
    await writeFile(source, "export const value = 1;\n", "utf8");
    const profile = await discoverProject(root);
    const revision = await workingTreeRevision(root);
    const finding: Finding = {
      id: "FF-TEST-STALE-001",
      section: "testing",
      title: "Prior structural check passed",
      severity: "INFO",
      confidence: "HIGH",
      status: "PASS",
      location: [{ path: "source.ts", line: 1 }],
      evidence: ["The earlier revision contained the expected structure."],
      impact: "A stale positive claim could hide changed behavior.",
      recommendation: "Re-run a current evidence producer.",
      safe_fix: false,
      verification: ["Re-run the current evidence producer."],
      standards: ["Fullstack Forge evidence protocol"]
    };
    const staleEvidence: GateEvidence = {
      evidence_type: "project-test",
      producer: "stale-test-producer",
      scope: ["repository"],
      timestamp: new Date().toISOString(),
      revision,
      status: "PASS",
      relevant_instance_ids: [],
      absence_proves_success: true,
      limitations: ["Fixture evidence applies only to the recorded revision."]
    };
    await writeReport(
      createReport(
        root,
        profile,
        [finding],
        "test audit",
        [],
        [],
        [],
        undefined,
        [staleEvidence],
        [],
        revision
      )
    );
    await writeFile(source, "export const value = 2;\n", "utf8");

    const result = await verifyFindings(root, "testing", profile, {
      allowRun: false,
      dryRun: false
    });
    assert.equal(result.report.findings[0]?.status, "NOT_VERIFIED");
    assert.ok(
      result.report.findings[0].evidence.some(
        (item) => item.includes("prior status PASS") && item.includes("current revision")
      )
    );
    assert.ok(result.report.residual_risk.some((item) => item.includes("demoted")));
    assert.equal(result.report.gate_evidence[0]?.status, "NOT_VERIFIED");
    assert.equal(result.report.gate_evidence[0].absence_proves_success, false);
    assert.ok(
      result.report.gate_evidence[0].limitations.some((item) => item.includes("did not reproduce"))
    );
    assert.notEqual(result.report.revision, revision);
  });
});

const sqlFixture = `export async function handler(req) {
  return db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);
}
`;

async function analyzerFinding(root: string, section: string, id: string): Promise<Finding> {
  const finding = (await runAnalyzers(section, root))
    .flatMap((run) => run.findings)
    .find((candidate) => candidate.id === id);
  assert.ok(finding, `expected ${id}`);
  return finding;
}
