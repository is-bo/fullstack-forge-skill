import assert from "node:assert/strict";
import { readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { ReportAuditLedger, orchestrateAudit } from "../src/audit-orchestration.js";
import {
  captureEvidenceArtifacts,
  createEvidenceEnvelope,
  evidenceClaimDigest,
  verifyEvidenceEnvelope
} from "../src/evidence-envelope.js";
import { discoverProject } from "../src/discovery.js";
import { runShipGates } from "../src/gates.js";
import { createReport } from "../src/report.js";
import type { GateEvidence } from "../src/types.js";
import { sha256, workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

test("only registered, root-bound Audit evidence can satisfy Ship", async () => {
  await withTemporaryProject("evidence-envelope", async (root) => {
    await writePackage(root);
    const profile = await discoverProject(root);
    const revision = await workingTreeRevision(root);
    const trusted = await auditEvidence(root, revision);
    const run = (record: GateEvidence) =>
      runShipGates(
        root,
        profile,
        createReport(root, profile, [], "audit", [], [], [], undefined, [record], [], revision),
        [],
        false
      );

    assert.equal(gateStatus(await run(trusted)), "PASS");

    const forged = structuredClone(trusted);
    forged.producer = "locally-planted";
    assert.equal(gateStatus(await run(forged)), "NOT_VERIFIED");

    const statusFlip = structuredClone(trusted);
    statusFlip.status = "FAIL";
    assert.equal(
      (await verifyEvidenceEnvelope({ root, revision, evidence: statusFlip })).verified,
      false
    );

    const typeSwap = structuredClone(trusted);
    typeSwap.evidence_type = "license-scan";
    assert.equal(
      (await verifyEvidenceEnvelope({ root, revision, evidence: typeSwap })).verified,
      false
    );

    const claimMutation = structuredClone(trusted);
    claimMutation.limitations.push("locally appended");
    assert.equal(
      (await verifyEvidenceEnvelope({ root, revision, evidence: claimMutation })).verified,
      false
    );

    const buildCollision = structuredClone(trusted);
    buildCollision.envelope = { ...trusted.envelope!, domain: "Build" };
    assert.equal(gateStatus(await run(buildCollision)), "NOT_VERIFIED");

    const incompatible = structuredClone(trusted);
    incompatible.envelope = {
      ...trusted.envelope!,
      producer_version: "9",
      contract: "other/v1"
    };
    assert.equal(gateStatus(await run(incompatible)), "NOT_VERIFIED");

    await writeFile(join(root, "package.json"), '{"name":"swapped"}\n', "utf8");
    const revisionMismatch = await verifyEvidenceEnvelope({
      root,
      revision: await workingTreeRevision(root),
      evidence: trusted
    });
    assert.equal(revisionMismatch.verified, false);
    const artifactSwap = await verifyEvidenceEnvelope({
      root,
      revision,
      evidence: trusted
    });
    assert.equal(artifactSwap.verified, false);
  });
});

test("evidence envelopes reject traversal, missing files, and cross-root reuse", async () => {
  await withTemporaryProject("evidence-envelope-a", async (root) => {
    await writePackage(root);
    const revision = await workingTreeRevision(root);
    await assert.rejects(
      createEvidenceEnvelope({
        root,
        revision,
        domain: "Audit",
        claim: auditClaim(revision),
        artifacts: [{ path: "../outside.json", media_type: "application/json" }]
      }),
      /Unsafe manifest path/u
    );
    await assert.rejects(
      createEvidenceEnvelope({
        root,
        revision,
        domain: "Audit",
        claim: auditClaim(revision),
        artifacts: [{ path: "missing.json", media_type: "application/json" }]
      })
    );
    const evidence = await auditEvidence(root, revision);
    await withTemporaryProject("evidence-envelope-b", async (otherRoot) => {
      await writePackage(otherRoot);
      const result = await verifyEvidenceEnvelope({
        root: otherRoot,
        revision: await workingTreeRevision(otherRoot),
        evidence
      });
      assert.equal(result.verified, false);
    });
  });
});

test("evidence envelopes reject symlinked artifacts", async (t) => {
  await withTemporaryProject("evidence-envelope-symlink", async (root) => {
    await writePackage(root);
    try {
      await symlink(join(root, "package.json"), join(root, "linked-package.json"), "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("The current Windows account cannot create symlinks.");
        return;
      }
      throw error;
    }
    await assert.rejects(
      createEvidenceEnvelope({
        root,
        revision: await workingTreeRevision(root),
        domain: "Audit",
        claim: auditClaim(await workingTreeRevision(root)),
        artifacts: [{ path: "linked-package.json", media_type: "application/json" }]
      }),
      /Refusing symlinked/u
    );
  });
});

test("runtime ledger preserves and validates one-to-one captured artifact hashes", async () => {
  await withTemporaryProject("runtime-envelope", async (root) => {
    await writePackage(root);
    const contents = await readFile(join(root, "package.json"));
    const revision = await workingTreeRevision(root);
    const ledger = new ReportAuditLedger(revision);
    await orchestrateAudit({
      root,
      modules: [],
      commands: [],
      allowRun: true,
      offline: false,
      dryRun: false,
      url: "http://127.0.0.1:3000/",
      ledger,
      collectRuntimeEvidence: () =>
        Promise.resolve({
          kind: "rendered-ui",
          status: "COMPLETE",
          artifacts: [
            { path: "package.json", sha256: sha256(contents), media_type: "application/json" }
          ],
          limitations: [],
          complete: true
        })
    });
    const runtime = ledger.ledgers().runtime_evidence[0];
    assert.ok(runtime);
    assert.deepEqual(runtime.artifact_paths, ["package.json"]);
    assert.deepEqual(runtime.hashes, [sha256(contents)]);
    assert.deepEqual(runtime.artifacts, [
      { path: "package.json", sha256: sha256(contents), media_type: "application/json" }
    ]);
  });
});

test("Ship command envelopes reject command and output claim replay", async () => {
  await withTemporaryProject("ship-command-envelope", async (root) => {
    await writePackage(root);
    const revision = await workingTreeRevision(root);
    const evidence = await shipCommandEvidence(root, revision);
    assert.equal((await verifyEvidenceEnvelope({ root, revision, evidence })).verified, true);

    const commandSwap = structuredClone(evidence);
    commandSwap.command!.name = "scan:secrets";
    commandSwap.envelope!.command!.name = "scan:secrets";
    commandSwap.envelope!.claim_sha256 = evidenceClaimDigest(commandSwap);
    assert.equal(
      (await verifyEvidenceEnvelope({ root, revision, evidence: commandSwap })).verified,
      false
    );

    const outputMutation = structuredClone(evidence);
    outputMutation.command!.output_sha256 = sha256("forged output");
    assert.equal(
      (await verifyEvidenceEnvelope({ root, revision, evidence: outputMutation })).verified,
      false
    );
  });
});

async function auditEvidence(root: string, revision: string): Promise<GateEvidence> {
  const record: GateEvidence = auditClaim(revision);
  record.envelope = await createEvidenceEnvelope({
    root,
    revision,
    domain: "Audit",
    claim: record,
    artifacts: [{ path: "package.json", media_type: "application/json" }]
  });
  return record;
}

function auditClaim(revision: string): Omit<GateEvidence, "envelope"> {
  return {
    evidence_type: "secret-scan",
    producer: "fullstack-forge/audit",
    scope: ["repository"],
    timestamp: new Date().toISOString(),
    revision,
    status: "PASS",
    relevant_instance_ids: [],
    absence_proves_success: true,
    limitations: ["Synthetic registered audit evidence."]
  };
}

async function shipCommandEvidence(root: string, revision: string): Promise<GateEvidence> {
  const manifest = await captureEvidenceArtifacts(root, [
    { path: "package.json", media_type: "application/json" }
  ]);
  const record: GateEvidence = {
    evidence_type: "project-test",
    producer: "fullstack-forge/ship-command",
    scope: ["repository"],
    timestamp: "2026-01-01T00:00:00.000Z",
    revision,
    status: "PASS",
    relevant_instance_ids: [],
    absence_proves_success: true,
    limitations: ["Synthetic command evidence."],
    command: {
      name: "test",
      argv: ["npm", "run", "test"],
      definition: "node --test",
      exit_code: 0,
      started_at: "2026-01-01T00:00:00.000Z",
      duration_ms: 1,
      output_sha256: sha256("ok"),
      input_manifest: manifest
    }
  };
  record.envelope = await createEvidenceEnvelope({
    root,
    revision,
    domain: "Ship",
    claim: record,
    artifacts: [{ path: "package.json", media_type: "application/json" }]
  });
  return record;
}

async function writePackage(root: string): Promise<void> {
  await writeFile(join(root, "package.json"), '{"name":"evidence-test","private":true}\n', "utf8");
}

function gateStatus(result: Awaited<ReturnType<typeof runShipGates>>): string {
  return result.gates.find((gate) => gate.gate_id === "FF-GATE-SECRETS")?.status ?? "missing";
}
