import assert from "node:assert/strict";
import { readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { ReportAuditLedger, orchestrateAudit } from "../src/audit-orchestration.js";
import { BUILD_PRODUCER_VERSION } from "../src/build-producers.js";
import { BUILD_RUNTIME_STATES, BUILD_RUNTIME_VIEWPORTS } from "../src/build-runtime.js";
import {
  buildEvidenceClaimDigest,
  captureEvidenceArtifacts,
  createBuildEvidenceEnvelope,
  createEvidenceEnvelope,
  evidenceClaimDigest,
  verifyBuildEvidenceEnvelopeIntegrity,
  type BuildEvidenceClaim,
  type EvidenceEnvelope,
  verifyEvidenceEnvelope
} from "../src/evidence-envelope.js";
import { discoverProject } from "../src/discovery.js";
import { runShipGates } from "../src/gates.js";
import { createReport } from "../src/report.js";
import type { GateEvidence } from "../src/types.js";
import { sha256, workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

test("persisted Audit evidence is verified as a diagnostic but never consumed by Ship", async () => {
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
    assert.equal(gateStatus(await run(forged)), "PASS");
    assert.equal(
      (await verifyEvidenceEnvelope({ root, revision, evidence: forged })).verified,
      false
    );

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
    assert.equal(gateStatus(await run(buildCollision)), "PASS");

    const incompatible = structuredClone(trusted);
    incompatible.envelope = {
      ...trusted.envelope!,
      producer_version: "9",
      contract: "other/v1"
    };
    assert.equal(gateStatus(await run(incompatible)), "PASS");

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

test("Build envelopes reject forged claims, roots, revisions, versions, and altered artifacts", async () => {
  await withTemporaryProject("build-envelope-a", async (root) => {
    await writePackage(root);
    const revision = await workingTreeRevision(root);
    const baseClaim = buildClaim();
    const claim: BuildEvidenceClaim & { envelope: EvidenceEnvelope } = {
      ...baseClaim,
      envelope: await createBuildEvidenceEnvelope({
        root,
        revision,
        claim: baseClaim,
        artifacts: [{ path: "package.json", media_type: "application/json" }]
      })
    };
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim })).verified,
      true
    );

    const handEdited = structuredClone(claim);
    handEdited.producer = "hand-edited";
    handEdited.envelope.producer = "hand-edited";
    handEdited.envelope.claim_sha256 = buildEvidenceClaimDigest(handEdited);
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim: handEdited })).verified,
      false
    );

    const versionChanged = structuredClone(claim);
    versionChanged.producer_version = "999";
    versionChanged.envelope.producer_version = "999";
    versionChanged.envelope.claim_sha256 = buildEvidenceClaimDigest(versionChanged);
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim: versionChanged }))
        .verified,
      false
    );
    assert.equal(
      (
        await verifyBuildEvidenceEnvelopeIntegrity({
          root,
          revision: `${revision}-other`,
          claim
        })
      ).verified,
      false
    );

    await withTemporaryProject("build-envelope-b", async (otherRoot) => {
      await writePackage(otherRoot);
      assert.equal(
        (
          await verifyBuildEvidenceEnvelopeIntegrity({
            root: otherRoot,
            revision: await workingTreeRevision(otherRoot),
            claim
          })
        ).verified,
        false
      );
    });

    const malformed = structuredClone(claim);
    malformed.envelope.claim_sha256 = "not-a-digest";
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim: malformed })).verified,
      false
    );

    const unknownField = structuredClone(claim);
    (unknownField.envelope as unknown as Record<string, unknown>).untrusted_extra = true;
    const unknownVerification = await verifyBuildEvidenceEnvelopeIntegrity({
      root,
      revision,
      claim: unknownField
    });
    assert.equal(unknownVerification.verified, false);
    assert.match(unknownVerification.reasons.join(" "), /unknown field/u);

    await writeFile(join(root, "package.json"), '{"name":"changed","private":true}\n', "utf8");
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim })).verified,
      false
    );
  });
});

test("reasoned Build exclusions are producer-restricted and bind the exclusion reason", async () => {
  await withTemporaryProject("build-envelope-na", async (root) => {
    await writePackage(root);
    const revision = await workingTreeRevision(root);
    const recordedAt = new Date().toISOString();
    const baseClaim: BuildEvidenceClaim = {
      criterion: "discipline:auth",
      discipline: "auth",
      security_control: true,
      status: "NOT_APPLICABLE",
      producer: "fullstack-forge/build-applicability/auth",
      producer_version: BUILD_PRODUCER_VERSION,
      evidence: ["No authentication risk surface was observed in the bounded scanned scope."],
      limitations: [],
      files: [{ path: "package.json", sha256: sha256(await readFile(join(root, "package.json"))) }],
      instance_ids: [],
      recorded_at: recordedAt,
      expires_at: new Date(Date.parse(recordedAt) + 86_400_000).toISOString(),
      not_applicable_reason: "No authentication routes, session store, or identity dependency."
    };
    const claim: BuildEvidenceClaim & { envelope: EvidenceEnvelope } = {
      ...baseClaim,
      envelope: await createBuildEvidenceEnvelope({
        root,
        revision,
        claim: baseClaim,
        artifacts: [{ path: "package.json", media_type: "application/json" }]
      })
    };
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim })).verified,
      true
    );
    const edited = structuredClone(claim);
    edited.not_applicable_reason = "locally rewritten";
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim: edited })).verified,
      false
    );
    await assert.rejects(
      createBuildEvidenceEnvelope({
        root,
        revision,
        claim: { ...baseClaim, producer: "fullstack-forge/build-analyzers" },
        artifacts: [{ path: "package.json", media_type: "application/json" }]
      }),
      /registered pair|applicability producer/u
    );
  });
});

test("rendered-UI PASS binds the complete typed state and viewport matrix", async () => {
  await withTemporaryProject("build-envelope-runtime", async (root) => {
    await writePackage(root);
    const revision = await workingTreeRevision(root);
    const recordedAt = new Date().toISOString();
    const runtime = BUILD_RUNTIME_STATES.flatMap((state) =>
      BUILD_RUNTIME_VIEWPORTS.map((viewport) => ({
        url: `http://127.0.0.1/${state}`,
        role: "representative-user",
        state,
        viewport: { ...viewport }
      }))
    );
    const baseClaim: BuildEvidenceClaim = {
      criterion: "runtime:rendered-ui",
      discipline: "ui",
      security_control: true,
      status: "PASS",
      producer: "fullstack-forge/build-runtime",
      producer_version: BUILD_PRODUCER_VERSION,
      evidence: ["Every required state and viewport was observed."],
      limitations: [],
      files: [{ path: "package.json", sha256: sha256(await readFile(join(root, "package.json"))) }],
      instance_ids: runtime.map((entry) => `${entry.state}:${entry.viewport.name}`),
      recorded_at: recordedAt,
      expires_at: new Date(Date.parse(recordedAt) + 86_400_000).toISOString(),
      runtime
    };
    const claim: BuildEvidenceClaim & { envelope: EvidenceEnvelope } = {
      ...baseClaim,
      envelope: await createBuildEvidenceEnvelope({
        root,
        revision,
        claim: baseClaim,
        artifacts: [{ path: "package.json", media_type: "application/json" }]
      })
    };
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim })).verified,
      true
    );
    await assert.rejects(
      createBuildEvidenceEnvelope({
        root,
        revision,
        claim: { ...baseClaim, runtime: runtime.slice(1) },
        artifacts: [{ path: "package.json", media_type: "application/json" }]
      }),
      /all required state and viewport/u
    );
    const edited = structuredClone(claim);
    assert.ok(edited.runtime);
    edited.runtime[0]!.url = "http://127.0.0.1/rewritten";
    assert.equal(
      (await verifyBuildEvidenceEnvelopeIntegrity({ root, revision, claim: edited })).verified,
      false
    );
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
  const timestamp = new Date().toISOString();
  const record: GateEvidence = {
    evidence_type: "project-test",
    producer: "fullstack-forge/ship-command",
    scope: ["repository"],
    timestamp,
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
      started_at: timestamp,
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

function buildClaim(): BuildEvidenceClaim {
  const recordedAt = new Date().toISOString();
  const packageBytes = Buffer.from('{"name":"evidence-test","private":true}\n');
  return {
    criterion: "scope-resolution",
    discipline: "code",
    security_control: false,
    status: "PASS",
    producer: "fullstack-forge/build-scope",
    producer_version: BUILD_PRODUCER_VERSION,
    evidence: ["Repository scope was resolved."],
    limitations: [],
    files: [{ path: "package.json", sha256: sha256(packageBytes) }],
    instance_ids: [],
    recorded_at: recordedAt,
    expires_at: new Date(Date.parse(recordedAt) + 86_400_000).toISOString()
  };
}

async function writePackage(root: string): Promise<void> {
  await writeFile(join(root, "package.json"), '{"name":"evidence-test","private":true}\n', "utf8");
}

function gateStatus(result: Awaited<ReturnType<typeof runShipGates>>): string {
  return result.gates.find((gate) => gate.gate_id === "FF-GATE-SECRETS")?.status ?? "missing";
}
