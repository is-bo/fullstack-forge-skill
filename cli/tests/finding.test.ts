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
  assert.deepEqual(
    validateFinding({
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
    }),
    []
  );
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
  const schema = JSON.parse(
    await readFile(
      join(PACKAGE_ROOT, "src", "fullstack-forge", "schemas", "finding.schema.json"),
      "utf8"
    )
  ) as { properties: Record<string, unknown> };
  assert.ok(schema.properties.instance_id);
  assert.ok(schema.properties.fix_attempts);
});
