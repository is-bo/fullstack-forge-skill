import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { validateFinding } from "../src/finding.js";
const valid = {
    id: "FF-AUTH-001",
    section: "auth",
    title: "Session is not rotated",
    severity: "HIGH",
    confidence: "HIGH",
    status: "FAIL",
    location: [{ path: "src/auth.ts", line: 12 }],
    evidence: ["A test reproduced session reuse after login."],
    impact: "A fixed session can be taken over.",
    recommendation: "Rotate the session identifier after authentication.",
    safe_fix: false,
    verification: ["Repeat the login flow and compare identifiers."],
    standards: ["OWASP ASVS 5.0"]
};
test("accepts a complete finding", () => {
    assert.deepEqual(validateFinding(valid), []);
});
test("rejects optimistic and malformed evidence records", () => {
    const errors = validateFinding({
        ...valid,
        id: "bad",
        status: "MAYBE",
        evidence: [],
        safe_fix: "yes"
    });
    assert.ok(errors.some((error) => error.includes("id")));
    assert.ok(errors.some((error) => error.includes("status")));
    assert.ok(errors.some((error) => error.includes("evidence")));
    assert.ok(errors.some((error) => error.includes("safe_fix")));
});
test("instance-specific verification and fix attempts satisfy the runtime contract", () => {
    assert.deepEqual(validateFinding({
        ...valid,
        instance_id: "FF-AUTH-001:12345678",
        fix_attempts: [
            {
                fix_id: "FF-FIX-AUTH-001",
                status: "BLOCKED",
                risk: "risky",
                reason: "Authorization policy requires approval.",
                attempted_at: "2026-07-19T12:00:00.000Z"
            }
        ],
        verification_plan: {
            actions: [
                {
                    type: "analyzer",
                    analyzer_id: "js-ts-boundaries",
                    finding_id: "FF-AUTH-001",
                    instance_id: "FF-AUTH-001:12345678",
                    scope_paths: ["src/auth.ts"],
                    absence_proves_resolution: true
                }
            ]
        }
    }), []);
});
test("malformed instance-specific verification is rejected", () => {
    const errors = validateFinding({
        ...valid,
        verification_plan: {
            actions: [
                {
                    type: "analyzer",
                    analyzer_id: "js-ts-boundaries",
                    finding_id: "FF-AUTH-001",
                    instance_id: "FF-OTHER-001:12345678",
                    scope_paths: ["../outside.ts"],
                    absence_proves_resolution: true
                }
            ]
        }
    });
    assert.ok(errors.some((error) => error.includes("verification_plan.actions")));
});
test("published finding schema exposes instance and fix lifecycle fields", async () => {
    const schema = JSON.parse(await readFile(join(PACKAGE_ROOT, "src", "fullstack-forge", "schemas", "finding.schema.json"), "utf8"));
    assert.ok(schema.properties.instance_id);
    assert.ok(schema.properties.fix_attempts);
    assert.ok(schema.properties.producer);
    assert.ok(schema.properties.commands_executed);
});
test("agent-authored findings require complete provenance and verification metadata", () => {
    const agentFinding = {
        ...valid,
        module: "auth",
        producer: "agent-reviewed-source",
        evidence_type: "source-review",
        explanation: "The login handler preserves the pre-authentication session identifier.",
        safe_fix_classification: "approval-required",
        revision: "worktree:1234",
        commands_executed: [{ command: "npm test -- auth", exit_code: 1 }],
        remaining_limitations: ["The production session store was not available."]
    };
    assert.deepEqual(validateFinding(agentFinding), []);
    const errors = validateFinding({ ...agentFinding, revision: "", commands_executed: undefined });
    assert.ok(errors.some((error) => error.includes("revision")));
    assert.ok(errors.some((error) => error.includes("commands_executed")));
});
test("rendered-review findings require structured rendered evidence", () => {
    const renderedFinding = {
        ...valid,
        module: "ui",
        producer: "agent-rendered-review",
        evidence_type: "rendered-review",
        explanation: "The primary action is clipped at the inspected narrow viewport.",
        safe_fix_classification: "approval-required",
        revision: "worktree:5678",
        commands_executed: [{ command: "forge ui review --url http://127.0.0.1:3000", exit_code: 0 }],
        remaining_limitations: ["No physical mobile device was available."],
        rendered_evidence: [
            {
                kind: "screenshot",
                observed: "The submit control extends beyond the right edge.",
                artifact_path: ".forge/evidence/booking-375.png",
                url: "http://127.0.0.1:3000/booking",
                viewport: { width: 375, height: 812 },
                state: "validation error",
                input_method: "keyboard"
            }
        ]
    };
    assert.deepEqual(validateFinding(renderedFinding), []);
    const errors = validateFinding({ ...renderedFinding, rendered_evidence: [] });
    assert.ok(errors.some((error) => error.includes("rendered_evidence")));
});
test("rendered-review findings reject malformed capture metadata", () => {
    const errors = validateFinding({
        ...valid,
        module: "ui",
        producer: "agent-rendered-review",
        evidence_type: "source-review",
        explanation: "The inspected evidence payload is malformed.",
        safe_fix_classification: "approval-required",
        revision: "worktree:9012",
        commands_executed: [],
        remaining_limitations: [],
        rendered_evidence: [
            "not-an-evidence-record",
            {
                kind: "screenshot",
                observed: "The capture metadata cannot identify a valid inspection context.",
                artifact_path: "",
                url: 42,
                state: "",
                input_method: "voice",
                viewport: { width: 0, height: 812 }
            }
        ]
    });
    for (const expected of [
        "evidence_type=rendered-review",
        "rendered_evidence[0] is invalid",
        "artifact_path must be a non-empty string",
        "url must be a non-empty string",
        "state must be a non-empty string",
        "input_method is invalid",
        "viewport is invalid",
        "requires rendered_evidence"
    ])
        assert.ok(errors.some((error) => error.includes(expected)), expected);
});
//# sourceMappingURL=finding.test.js.map