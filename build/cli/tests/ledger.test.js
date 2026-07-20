import assert from "node:assert/strict";
import test from "node:test";
import { appendModuleDecision, appendPlannedCheck, appendRuntimeEvidence, appendToolRecord, createPlannedCheck, recordBlockedCheck, recordExecutedCheck } from "../src/ledger.js";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
function plan(id, overrides = {}) {
    return createPlannedCheck({
        check_id: id,
        module: "security",
        source: "forge-security module procedure",
        command: ["npm", "test"],
        requires_authorization: false,
        network_policy: "OFFLINE_SAFE",
        ...overrides
    });
}
function evidence(id, overrides = {}) {
    return {
        evidence_id: id,
        evidence_type: "rendered-ui-capture",
        status: "PASS",
        revision: "tree:abc123",
        artifact_paths: [".forge/evidence/home.png"],
        hashes: [HASH_A],
        limitations: [],
        ...overrides
    };
}
test("a planned check starts NOT_RUN and states why", () => {
    const check = plan("FF-CHK-001");
    assert.equal(check.status, "NOT_RUN");
    assert.ok(check.reason);
    assert.equal(check.requires_authorization, false);
    assert.equal(check.network_policy, "OFFLINE_SAFE");
});
test("planned checks deduplicate by check_id and preserve append order", () => {
    let ledger = [];
    ledger = appendPlannedCheck(ledger, plan("FF-CHK-001"));
    ledger = appendPlannedCheck(ledger, plan("FF-CHK-002", { module: "uploads" }));
    ledger = appendPlannedCheck(ledger, plan("FF-CHK-001", { module: "security" }));
    assert.deepEqual(ledger.map((check) => check.check_id), ["FF-CHK-001", "FF-CHK-002"]);
    // Reordering the ledger would change the rendered report for identical inputs.
    assert.equal(ledger[1]?.module, "uploads");
});
test("a blocked check can never be re-recorded as run", () => {
    let ledger = appendPlannedCheck([], plan("FF-CHK-001"));
    ledger = recordBlockedCheck(ledger, "FF-CHK-001", "Execution requires --allow-run.");
    assert.equal(ledger[0]?.status, "BLOCKED");
    assert.throws(() => recordExecutedCheck(ledger, "FF-CHK-001"), /cannot be re-recorded as RUN/u, "a block that later reports a result would erase the block");
    assert.throws(() => appendPlannedCheck(ledger, plan("FF-CHK-001", { status: "RUN" })), /cannot be re-recorded as RUN/u);
    assert.equal(ledger[0].status, "BLOCKED", "the rejected write must not mutate the ledger");
});
test("blocking a check requires a reason and executing one records RUN", () => {
    const ledger = appendPlannedCheck([], plan("FF-CHK-001"));
    assert.throws(() => recordBlockedCheck(ledger, "FF-CHK-001", "  "), /requires a reason/u);
    assert.throws(() => recordBlockedCheck(ledger, "FF-CHK-404", "missing"), /No planned check/u);
    const executed = recordExecutedCheck(ledger, "FF-CHK-001", { command: ["npm", "run", "lint"] });
    assert.equal(executed[0]?.status, "RUN");
    assert.deepEqual(executed[0].command, ["npm", "run", "lint"]);
    assert.equal(ledger[0]?.status, "NOT_RUN", "ledger functions never mutate their input");
});
test("a check that did not run must state a reason", () => {
    assert.throws(() => appendPlannedCheck([], {
        check_id: "FF-CHK-001",
        module: "security",
        source: "manual",
        status: "NOT_APPLICABLE",
        requires_authorization: false,
        network_policy: "UNKNOWN"
    }), /requires a reason/u);
});
test("planned checks record authorization and network policy", () => {
    const check = plan("FF-CHK-NET", {
        requires_authorization: true,
        network_policy: "NETWORK_REQUIRED"
    });
    assert.equal(check.requires_authorization, true);
    assert.equal(check.network_policy, "NETWORK_REQUIRED");
    assert.throws(() => plan("FF-CHK-BAD", { network_policy: "SOMETIMES" }), /invalid network_policy/u);
});
test("runtime evidence merges artifacts and hashes without upgrading a blocked result", () => {
    let ledger = appendRuntimeEvidence([], evidence("EV-1", { status: "BLOCKED", limitations: ["Browser launch was refused."] }));
    ledger = appendRuntimeEvidence(ledger, evidence("EV-1", {
        status: "BLOCKED",
        artifact_paths: [".forge/evidence/partial.png"],
        hashes: [HASH_B],
        limitations: ["Only one of three viewports was captured."]
    }));
    assert.equal(ledger.length, 1);
    assert.deepEqual(ledger[0]?.artifact_paths, [
        ".forge/evidence/home.png",
        ".forge/evidence/partial.png"
    ]);
    assert.deepEqual(ledger[0].hashes, [HASH_A, HASH_B]);
    assert.equal(ledger[0].limitations.length, 2);
    assert.throws(() => appendRuntimeEvidence(ledger, evidence("EV-1", { status: "PASS" })), /cannot be re-recorded as PASS/u);
});
test("partial rendered evidence is representable but must declare its limitations", () => {
    const partial = appendRuntimeEvidence([], evidence("EV-PARTIAL", {
        status: "NOT_VERIFIED",
        artifact_paths: [".forge/evidence/mobile.png"],
        limitations: ["Desktop and tablet viewports were not captured."]
    }));
    assert.equal(partial[0]?.status, "NOT_VERIFIED");
    assert.throws(() => appendRuntimeEvidence([], evidence("EV-SILENT", { status: "NOT_VERIFIED" })), /requires at least one limitation/u, "a partial capture with no stated limitation reads as a clean result");
});
test("runtime evidence rejects unsafe artifact paths and malformed hashes", () => {
    assert.throws(() => appendRuntimeEvidence([], evidence("EV-ESCAPE", { artifact_paths: ["../secrets.env"] })), /safe repository-relative paths/u);
    assert.throws(() => appendRuntimeEvidence([], evidence("EV-ABS", { artifact_paths: ["/etc/passwd"] })), /safe repository-relative paths/u);
    assert.throws(() => appendRuntimeEvidence([], evidence("EV-HASH", { hashes: ["not-a-hash"] })), /lowercase sha256 digests/u);
    assert.throws(() => appendRuntimeEvidence([], evidence("EV-HASH2", { hashes: [HASH_A.toUpperCase()] })), /lowercase sha256 digests/u);
    assert.doesNotThrow(() => appendRuntimeEvidence([], evidence("EV-PREFIX", { hashes: [`sha256:${HASH_A}`] })));
});
test("module decisions deduplicate by module and merge their reasons", () => {
    let ledger = appendModuleDecision([], {
        module: "ui",
        capability_status: "PRESENT",
        selection_status: "OUT_OF_CHANGED_SCOPE",
        reasons: ["No changed file reached this module."],
        evidence: ["app/page.tsx"]
    });
    ledger = appendModuleDecision(ledger, {
        module: "ui",
        capability_status: "PRESENT",
        selection_status: "OUT_OF_CHANGED_SCOPE",
        reasons: ["The module was also outside the active risk filter."],
        evidence: ["app/page.tsx"]
    });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.reasons.length, 2);
    assert.deepEqual(ledger[0].evidence, ["app/page.tsx"]);
    assert.throws(() => appendModuleDecision(ledger, {
        module: "api",
        capability_status: "MAYBE",
        selection_status: "SELECTED",
        reasons: ["x"],
        evidence: []
    }), /invalid capability_status/u);
});
test("tool records distinguish ownership, trust, and an unknown version", () => {
    const forgeOwned = {
        tool_id: "forge:inspect-routes",
        name: "Fullstack Forge route inspector",
        ownership: "forge-owned",
        trust: "trusted",
        version: "0.1.6",
        version_source: "observed",
        limitations: []
    };
    let ledger = appendToolRecord([], forgeOwned);
    ledger = appendToolRecord(ledger, {
        tool_id: "project:npm-test",
        name: "npm test",
        ownership: "project-owned",
        trust: "unknown",
        version: "unknown",
        version_source: "unknown",
        invocation: ["npm", "test"],
        limitations: ["The project script contents were not reviewed before execution."]
    });
    ledger = appendToolRecord(ledger, {
        tool_id: "external:trivy",
        name: "Trivy",
        ownership: "external",
        trust: "untrusted",
        version: "0.50.0",
        version_source: "declared",
        limitations: ["The declared version was not verified against the running binary."]
    });
    assert.deepEqual(ledger.map((tool) => `${tool.ownership}/${tool.trust}`), ["forge-owned/trusted", "project-owned/unknown", "external/untrusted"]);
    // A version that could not be observed must not be presented as determined.
    assert.throws(() => appendToolRecord([], {
        ...forgeOwned,
        tool_id: "forge:guessed",
        version: "0.1.6",
        version_source: "unknown"
    }), /must record version 'unknown'/u);
    // A tool that is not trusted has to say what that costs the reader.
    assert.throws(() => appendToolRecord([], {
        ...forgeOwned,
        tool_id: "external:silent",
        ownership: "external",
        trust: "untrusted",
        limitations: []
    }), /requires at least one recorded limitation/u);
});
test("ledger appends are deterministic for identical inputs", () => {
    const build = () => {
        let ledger = [];
        for (const id of ["FF-C", "FF-A", "FF-B", "FF-A"])
            ledger = appendPlannedCheck(ledger, plan(id));
        return ledger;
    };
    assert.deepEqual(build(), build());
    assert.deepEqual(build().map((check) => check.check_id), ["FF-C", "FF-A", "FF-B"]);
});
//# sourceMappingURL=ledger.test.js.map