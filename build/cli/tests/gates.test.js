import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { createEvidenceEnvelope, evidenceClaimDigest } from "../src/evidence-envelope.js";
import { evaluateGateOutcome, runShipGates } from "../src/gates.js";
import { createReport } from "../src/report.js";
import { sha256, workingTreeRevision } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";
test("gate outcome fails closed for required FAIL, BLOCKED, and NOT_VERIFIED states", () => {
    assert.equal(evaluateGateOutcome([syntheticGate("PASS")]), "PASS");
    assert.equal(evaluateGateOutcome([syntheticGate("FAIL")]), "FAIL");
    assert.equal(evaluateGateOutcome([syntheticGate("BLOCKED")]), "BLOCKED");
    assert.equal(evaluateGateOutcome([syntheticGate("NOT_VERIFIED")]), "BLOCKED");
    assert.equal(evaluateGateOutcome([{ ...syntheticGate("NOT_APPLICABLE"), required: false }]), "PASS");
});
test("persisted critical and high findings are diagnostics only", async (t) => {
    for (const severity of ["CRITICAL", "HIGH"]) {
        await t.test(severity, async () => {
            await withTemporaryProject(`gate-${severity}`, async (root) => {
                await writePackage(root, "ordinary-project");
                const profile = await discoverProject(root);
                const previous = createReport(root, profile, [openFinding(severity)], "audit");
                const result = await runShipGates(root, profile, previous, [], false);
                assert.equal(gateById(result.gates, "FF-GATE-OPEN-FINDINGS").status, "PASS");
                assert.match(gateById(result.gates, "FF-GATE-PRIOR-DIAGNOSTICS").evidence.join(" "), /not used for any Ship outcome/u);
            });
        });
    }
});
test("a persisted unverified high finding cannot block current Ship evidence", async () => {
    await withTemporaryProject("gate-unverified-high", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const finding = { ...openFinding("HIGH"), status: "NOT_VERIFIED" };
        const result = await runShipGates(root, profile, createReport(root, profile, [finding], "audit"), [], false);
        assert.equal(gateById(result.gates, "FF-GATE-OPEN-FINDINGS").status, "PASS");
        assert.equal(result.status, "BLOCKED");
    });
});
test("missing project commands and applicable high-risk evidence block release", async () => {
    await withTemporaryProject("gate-capability", async (root) => {
        await writePackage(root, "ordinary-project", {
            express: "0.0.0-fixture",
            multer: "0.0.0-fixture"
        });
        await writeFile(join(root, "app.ts"), "const tenantId = req.params.tenantId; app.post('/upload', upload.any(), handler);\n", "utf8");
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        assert.equal(result.status, "FAIL");
        assert.equal(gateById(result.gates, "FF-GATE-PROJECT-NONE").status, "BLOCKED");
        assert.equal(gateById(result.gates, "FF-GATE-TENANT-EVAL").status, "NOT_VERIFIED");
        assert.equal(gateById(result.gates, "FF-GATE-UPLOAD-EVAL").status, "FAIL");
    });
});
test("security evaluation is required even when no optional capability was discovered", async () => {
    await withTemporaryProject("gates-security", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const result = await runShipGates(root, profile, createReport(root, profile, [], "audit"), [], false);
        const security = result.gates.find((gate) => gate.gate_id === "FF-GATE-SECURITY-EVAL");
        assert.ok(security);
        assert.equal(security.required, true);
        assert.equal(security.status, "NOT_VERIFIED");
        assert.equal(result.status, "BLOCKED");
    });
});
test("ship preflight uses current inspection instead of requiring a prior report", async () => {
    await withTemporaryProject("gates-preflight", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const command = {
            name: "test",
            executable: process.execPath,
            args: ["-e", "require('node:fs').writeFileSync('should-not-run.txt', 'ran')"],
            source: "package.json",
            definition: "synthetic side effect"
        };
        const result = await runShipGates(root, profile, undefined, [command], true);
        assert.equal(result.status, "BLOCKED");
        assert.equal(result.execution.length, 1);
        assert.equal(await readFile(join(root, "should-not-run.txt"), "utf8"), "ran");
    });
});
test("persisted source snapshots do not control current evidence freshness", async () => {
    await withTemporaryProject("gates-freshness", async (root) => {
        await writePackage(root, "ordinary-project");
        const source = "export const ready = true;\n";
        await writeFile(join(root, "app.ts"), source, "utf8");
        const profile = await discoverProject(root);
        const finding = {
            ...openFinding("HIGH"),
            severity: "INFO",
            status: "PASS",
            evidence_snapshot: [{ path: "app.ts", sha256: sha256(source), excerpt_hash: sha256("ready") }]
        };
        const current = await runShipGates(root, profile, createReport(root, profile, [finding], "audit"), [], false);
        assert.equal(gateById(current.gates, "FF-GATE-AUDIT-FRESHNESS").status, "PASS");
        await writeFile(join(root, "app.ts"), "export const ready = false;\n", "utf8");
        const stale = await runShipGates(root, profile, createReport(root, profile, [finding], "audit"), [], false);
        assert.equal(gateById(stale.gates, "FF-GATE-AUDIT-FRESHNESS").status, "PASS");
        assert.equal(stale.status, "BLOCKED");
    });
});
test("applicable authorization and migration gates block when their evaluation did not run", async () => {
    await withTemporaryProject("gate-auth-db", async (root) => {
        await writePackage(root, "ordinary-project", {
            express: "0.0.0-fixture",
            passport: "0.0.0-fixture",
            "@prisma/client": "0.0.0-fixture"
        });
        await writeFile(join(root, "app.ts"), "const policy = authorize(role);\n", "utf8");
        const profile = await discoverProject(root);
        const previous = createReport(root, profile, [], "audit");
        const result = await runShipGates(root, profile, previous, [], false);
        assert.equal(gateById(result.gates, "FF-GATE-AUTH-EVAL").status, "NOT_VERIFIED");
        assert.equal(gateById(result.gates, "FF-GATE-MIGRATIONS").status, "NOT_VERIFIED");
        assert.equal(result.status, "BLOCKED");
    });
});
test("each required Forge release command failure maps to a failing explicit gate", async (t) => {
    const cases = [
        ["check:platforms", "FF-GATE-PLATFORMS"],
        ["package:platforms", "FF-GATE-PACKAGING"],
        ["validate:dist", "FF-GATE-ARCHIVES"],
        ["smoke:install", "FF-GATE-SMOKE"],
        ["check:licenses", "FF-GATE-LICENSES"],
        ["test", "FF-GATE-EVALS"]
    ];
    for (const [commandName, gateId] of cases) {
        await t.test(commandName, async () => {
            await withTemporaryProject(`gate-command-${commandName}`, async (root) => {
                await writePackage(root, "fullstack-forge-skill");
                const profile = await discoverProject(root);
                const previous = createReport(root, profile, [], "audit");
                const command = {
                    name: commandName,
                    executable: process.execPath,
                    args: ["-e", "process.exit(7)"],
                    source: "package.json",
                    definition: "synthetic failing gate"
                };
                const result = await runShipGates(root, profile, previous, [command], true, {
                    offline: false,
                    forgeOwned: true
                });
                assert.equal(result.status, "FAIL");
                assert.equal(gateById(result.gates, gateId).status, "FAIL");
            });
        });
    }
});
test("persisted SQL findings do not alter freshly re-derived secret evidence", async () => {
    await withTemporaryProject("gate-semantic-secret", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const sql = {
            ...openFinding("HIGH"),
            id: "FF-SEC-SQL-001",
            title: "SQL injection",
            section: "security"
        };
        const failed = await runShipGates(root, profile, await typedReport(root, profile, [], [sql]), [], false);
        assert.equal(gateById(failed.gates, "FF-GATE-SECRETS").status, "PASS");
        const clean = { ...sql, status: "PASS", severity: "INFO" };
        const cleanResult = await runShipGates(root, profile, await typedReport(root, profile, [], [clean]), [], false);
        assert.equal(gateById(cleanResult.gates, "FF-GATE-SECRETS").status, "PASS");
    });
});
test("persisted typed evidence cannot satisfy any current gate", async () => {
    await withTemporaryProject("gate-semantic-types", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const run = async (records) => runShipGates(root, profile, createReport(root, profile, [], "audit", [], [], [], undefined, records, [], revision), [], false);
        const secret = await run([await trustedEvidence(root, "secret-scan", revision, "PASS")]);
        assert.equal(gateById(secret.gates, "FF-GATE-SECRETS").status, "PASS");
        assert.equal(gateById(secret.gates, "FF-GATE-DEPENDENCIES").status, "NOT_VERIFIED");
        assert.equal(gateById(secret.gates, "FF-GATE-LICENSES").status, "NOT_VERIFIED");
        const dependencies = await run([
            await trustedEvidence(root, "dependency-audit", revision, "PASS"),
            await trustedEvidence(root, "lockfile-inspection", revision, "PASS")
        ]);
        assert.equal(gateById(dependencies.gates, "FF-GATE-DEPENDENCIES").status, "NOT_VERIFIED");
        assert.equal(gateById(dependencies.gates, "FF-GATE-SECRETS").status, "PASS");
        assert.equal(gateById(dependencies.gates, "FF-GATE-LICENSES").status, "NOT_VERIFIED");
        const licenses = await run([await trustedEvidence(root, "license-scan", revision, "PASS")]);
        assert.equal(gateById(licenses.gates, "FF-GATE-LICENSES").status, "NOT_VERIFIED");
        assert.equal(gateById(licenses.gates, "FF-GATE-DEPENDENCIES").status, "NOT_VERIFIED");
    });
});
test("failed and stale persisted typed evidence remain diagnostics", async () => {
    await withTemporaryProject("gate-semantic-stale", async (root) => {
        await writePackage(root, "ordinary-project");
        const profile = await discoverProject(root);
        const revision = await workingTreeRevision(root);
        const failed = await runShipGates(root, profile, createReport(root, profile, [], "audit", [], [], [], undefined, [await trustedEvidence(root, "secret-scan", revision, "FAIL")], [], revision), [], false);
        assert.equal(gateById(failed.gates, "FF-GATE-SECRETS").status, "PASS");
        const stale = await trustedEvidence(root, "secret-scan", revision, "PASS");
        stale.timestamp = "2020-01-01T00:00:00.000Z";
        stale.envelope.claim_sha256 = evidenceClaimDigest(stale);
        const staleResult = await runShipGates(root, profile, createReport(root, profile, [], "audit", [], [], [], undefined, [stale], [], revision), [], false);
        assert.equal(gateById(staleResult.gates, "FF-GATE-SECRETS").status, "PASS");
    });
});
async function typedReport(root, profile, records, findings = []) {
    const revision = await workingTreeRevision(root);
    return createReport(root, profile, findings, "audit", [], [], [], undefined, records.map((record) => ({ ...record, revision })), [], revision);
}
function evidence(evidenceType, revision, status) {
    return {
        evidence_type: evidenceType,
        producer: `test:${evidenceType}`,
        scope: ["repository"],
        timestamp: new Date().toISOString(),
        revision,
        status,
        relevant_instance_ids: [],
        absence_proves_success: true,
        limitations: ["Synthetic gate-isolation evidence."]
    };
}
async function trustedEvidence(root, evidenceType, revision, status) {
    const record = evidence(evidenceType, revision, status);
    record.producer = "fullstack-forge/audit";
    record.envelope = await createEvidenceEnvelope({
        root,
        revision,
        domain: "Audit",
        claim: record,
        artifacts: [{ path: "package.json", media_type: "application/json" }]
    });
    return record;
}
function syntheticGate(status) {
    return {
        gate_id: "FF-GATE-TEST",
        name: "Synthetic gate",
        category: "internal",
        required: true,
        status,
        evidence: ["test"],
        evidence_records: []
    };
}
function openFinding(severity) {
    return {
        id: `FF-SHIP-${severity === "CRITICAL" ? "901" : "902"}`,
        section: "security",
        title: `Open ${severity.toLowerCase()} finding`,
        severity,
        confidence: "HIGH",
        status: "FAIL",
        location: [{ path: "src/app.ts", line: 1 }],
        evidence: ["A directly observed release blocker remains open."],
        impact: "The release can cause severe harm.",
        recommendation: "Resolve and verify the finding before release.",
        safe_fix: false,
        verification: ["Repeat the original reproduction."],
        standards: ["Fullstack Forge evidence protocol"]
    };
}
async function writePackage(root, name, dependencies = {}) {
    await writeFile(join(root, "package.json"), `${JSON.stringify({ name, private: true, dependencies }, null, 2)}\n`, "utf8");
}
function gateById(gates, id) {
    const gate = gates.find((candidate) => candidate.gate_id === id);
    assert.ok(gate, `expected ${id}`);
    return gate;
}
//# sourceMappingURL=gates.test.js.map