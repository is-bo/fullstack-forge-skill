import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { captureEvidenceArtifacts, createEvidenceEnvelope, evidenceClaimDigest, verifyEvidenceEnvelope } from "../src/evidence-envelope.js";
import { discoverProject } from "../src/discovery.js";
import { runShipGates } from "../src/gates.js";
import { createReport } from "../src/report.js";
import { sha256, workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
test("forged prior Ship evidence is diagnostic and cannot satisfy a current gate", async () => {
    await withTemporaryProject("ship-prior-forgery", async (root) => {
        await writePackage(root);
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const prior = await priorShipLicenseEvidence(root, revision);
        prior.status = "FAIL";
        prior.envelope.claim_sha256 = evidenceClaimDigest(prior);
        const previous = createReport(root, profile, [], "ship", [], [], [], undefined, [prior], [], revision);
        const result = await runShipGates(root, profile, previous, [], false);
        assert.equal(gateById(result.gates, "FF-GATE-LICENSES").status, "NOT_VERIFIED");
        assert.match(gateById(result.gates, "FF-GATE-PRIOR-DIAGNOSTICS").evidence.join(" "), /not used for any Ship outcome/u);
        assert.ok(result.evidence.every((record) => record !== prior));
    });
});
test("Build-domain evidence can never satisfy Audit or Ship", async () => {
    await withTemporaryProject("ship-build-domain", async (root) => {
        await writePackage(root);
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const buildEvidence = await priorShipLicenseEvidence(root, revision);
        buildEvidence.envelope = { ...buildEvidence.envelope, domain: "Build" };
        const verification = await verifyEvidenceEnvelope({ root, revision, evidence: buildEvidence });
        assert.deepEqual(verification, {
            verified: false,
            reasons: ["Build-domain evidence is never eligible for Ship gates."]
        });
        const previous = createReport(root, profile, [], "audit", [], [], [], undefined, [buildEvidence], [], revision);
        const result = await runShipGates(root, profile, previous, [], false);
        assert.equal(gateById(result.gates, "FF-GATE-LICENSES").status, "NOT_VERIFIED");
    });
});
test("stale and edited prior artifacts and claims remain diagnostics only", async () => {
    await withTemporaryProject("ship-prior-stale", async (root) => {
        await writePackage(root);
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const stale = await priorShipLicenseEvidence(root, revision);
        stale.limitations.push("locally edited persisted claim");
        await writeFile(join(root, "package.json"), '{"name":"changed-after-prior"}\n', "utf8");
        const currentProfile = await discoverProject(root);
        const previous = createReport(root, profile, [], "ship", [], [], [], undefined, [stale], [], revision);
        const result = await runShipGates(root, currentProfile, previous, [], false);
        assert.equal(gateById(result.gates, "FF-GATE-LICENSES").status, "NOT_VERIFIED");
        assert.ok(result.evidence.every((record) => record.producer !== "locally-edited"));
    });
});
test("current Ship inspection evidence is fresh, file-bound, and independently verified", async () => {
    await withTemporaryProject("ship-current-evidence", async (root) => {
        await writePackage(root);
        await writeFile(join(root, "safe.ts"), "export const value = 1;\n", "utf8");
        const profile = await discoverProject(root);
        const result = await runShipGates(root, profile, undefined, [], false);
        const secrets = gateById(result.gates, "FF-GATE-SECRETS");
        assert.equal(secrets.status, "PASS");
        const freshness = gateById(result.gates, "FF-GATE-AUDIT-FRESHNESS");
        assert.equal(freshness.status, "PASS", freshness.evidence.join("\n"));
        const current = secrets.evidence_records.find((record) => record.evidence_type === "secret-scan");
        assert.ok(current);
        assert.equal(current.producer, "fullstack-forge/ship-inspector");
        assert.equal(current.envelope?.domain, "Ship");
        assert.ok(current.envelope.artifacts.some((artifact) => artifact.path === "safe.ts"));
        assert.equal((await verifyEvidenceEnvelope({ root, revision: result.revision, evidence: current }))
            .verified, true);
        const editedClaim = structuredClone(current);
        editedClaim.limitations.push("edited after derivation");
        assert.equal((await verifyEvidenceEnvelope({ root, revision: result.revision, evidence: editedClaim }))
            .verified, false);
        await writeFile(join(root, "safe.ts"), "export const value = 2;\n", "utf8");
        assert.equal((await verifyEvidenceEnvelope({ root, revision: result.revision, evidence: current }))
            .verified, false);
    });
});
test("a freshly re-derived secret finding fails Ship even when the prior report claims PASS", async () => {
    await withTemporaryProject("ship-current-failure", async (root) => {
        await writePackage(root);
        await writeFile(join(root, "secret.ts"), 'export const apiKey = "fixture-live-looking-credential-123456";\n', "utf8");
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const priorPass = await priorShipLicenseEvidence(root, revision);
        const previous = createReport(root, profile, [], "ship", [], [], [], undefined, [priorPass], [], revision);
        const result = await runShipGates(root, profile, previous, [], false);
        assert.equal(gateById(result.gates, "FF-GATE-SECRETS").status, "FAIL");
        assert.equal(gateById(result.gates, "FF-GATE-OPEN-FINDINGS").status, "FAIL");
        assert.equal(result.status, "FAIL");
    });
});
test("a command that edits its bound definition cannot produce a current PASS claim", async () => {
    await withTemporaryProject("ship-command-edits-source", async (root) => {
        await writePackage(root);
        const profile = await discoverProject(root);
        const command = {
            name: "check:licenses",
            executable: process.execPath,
            args: ["-e", "require('node:fs').writeFileSync('package.json', '{\"name\":\"mutated\"}\\n')"],
            source: "package.json",
            definition: "synthetic command mutating its own definition source"
        };
        const result = await runShipGates(root, profile, undefined, [command], true);
        const licenses = gateById(result.gates, "FF-GATE-LICENSES");
        assert.equal(licenses.status, "NOT_VERIFIED");
        assert.equal(result.status, "BLOCKED");
        assert.match(licenses.evidence.join(" "), /artifact hash mismatch/u);
        assert.equal(licenses.evidence_records.some((record) => record.status === "PASS" && record.producer === "fullstack-forge/ship-command"), false);
        assert.ok(licenses.evidence_records.some((record) => record.status === "NOT_VERIFIED" &&
            record.producer === "fullstack-forge/ship-command" &&
            record.envelope === undefined));
    });
});
test("an unmapped project gate also rejects a command that edits its definition source", async () => {
    await withTemporaryProject("ship-direct-command-edits-source", async (root) => {
        await writePackage(root);
        const profile = await discoverProject(root);
        const command = {
            name: "lint",
            executable: process.execPath,
            args: ["-e", "require('node:fs').writeFileSync('package.json', '{\"name\":\"mutated\"}\\n')"],
            source: "package.json",
            definition: "synthetic lint mutating its own definition source"
        };
        const result = await runShipGates(root, profile, undefined, [command], true);
        const lint = gateById(result.gates, "FF-GATE-PROJECT-LINT");
        assert.equal(lint.status, "BLOCKED");
        assert.match(lint.evidence.join(" "), /input artifact changed/u);
        assert.equal(lint.evidence_records.length, 0);
    });
});
test("Ship command results redact secrets while retaining a hash-bound current claim", async () => {
    await withTemporaryProject("ship-command-redaction", async (root) => {
        await writePackage(root);
        const profile = await discoverProject(root);
        const secret = "SKfaketest99887766554433";
        const command = {
            name: "check:licenses",
            executable: process.execPath,
            args: ["-e", `console.log("api_key=${secret}")`],
            source: "package.json",
            definition: `api_key=${secret} node synthetic-license-check`
        };
        const result = await runShipGates(root, profile, undefined, [command], true);
        const serialized = JSON.stringify(result);
        const licenses = gateById(result.gates, "FF-GATE-LICENSES");
        const evidence = licenses.evidence_records.find((record) => record.producer === "fullstack-forge/ship-command");
        assert.ok(!serialized.includes(secret), "Ship result retained a secret from command input/output");
        assert.match(serialized, /REDACTED/u);
        assert.equal(licenses.status, "PASS");
        assert.ok(evidence?.command);
        assert.match(evidence.command.definition, /REDACTED/u);
        assert.match(result.execution[0]?.output ?? "", /REDACTED/u);
        assert.equal((await verifyEvidenceEnvelope({ root, revision: result.revision, evidence })).verified, true);
    });
});
async function priorShipLicenseEvidence(root, revision) {
    const inputManifest = await captureEvidenceArtifacts(root, [
        { path: "package.json", media_type: "application/json" }
    ]);
    const record = {
        evidence_type: "license-scan",
        producer: "fullstack-forge/ship-command",
        scope: ["repository"],
        timestamp: new Date().toISOString(),
        revision,
        status: "PASS",
        relevant_instance_ids: [],
        absence_proves_success: true,
        limitations: ["Persisted Ship evidence fixture."],
        command: {
            name: "check:licenses",
            argv: ["npm", "run", "check:licenses"],
            definition: "node scripts/check-licenses.mjs",
            exit_code: 0,
            started_at: new Date().toISOString(),
            duration_ms: 1,
            output_sha256: sha256("ok"),
            input_manifest: inputManifest
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
async function writePackage(root) {
    await writeFile(root + "/package.json", '{"name":"ordinary-project","private":true}\n', "utf8");
}
function gateById(gates, id) {
    const gate = gates.find((candidate) => candidate.gate_id === id);
    assert.ok(gate, `expected ${id}`);
    return gate;
}
//# sourceMappingURL=ship-rederivation.test.js.map