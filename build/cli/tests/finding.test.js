import assert from "node:assert/strict";
import test from "node:test";
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
//# sourceMappingURL=finding.test.js.map