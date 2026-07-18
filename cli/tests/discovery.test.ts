import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { discoverProject } from "../src/discovery.js";
import { inspectWithTool } from "../src/inspectors.js";

type Expectation = {
  capabilities: string[];
  tools: Record<string, number>;
};

test("all ten flawed fixtures produce their declared discovery and tool signals", async (t) => {
  const fixturesRoot = join(PACKAGE_ROOT, "fixtures");
  const fixtureNames = (await readdir(fixturesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(fixtureNames, [
    "bad-upload-pipeline",
    "broken-auth",
    "cache-data-leak",
    "cross-tenant-leak",
    "inaccessible-dashboard",
    "insecure-api",
    "slow-postgres-app",
    "unsafe-ai-invoice",
    "unsigned-payment-webhook",
    "unverified-backup"
  ]);
  for (const name of fixtureNames) {
    await t.test(name, async () => {
      const root = join(fixturesRoot, name);
      const expected = JSON.parse(
        await readFile(join(root, "expected-findings.json"), "utf8")
      ) as Expectation;
      const profile = await discoverProject(root);
      for (const capability of expected.capabilities)
        assert.ok(profile.capabilities[capability], `${name} should detect ${capability}`);
      for (const [tool, minimum] of Object.entries(expected.tools)) {
        const result = await inspectWithTool(tool as Parameters<typeof inspectWithTool>[0], root);
        assert.ok(
          result.observations.length + result.findings.length >= minimum,
          `${name} ${tool} expected at least ${minimum} signal(s)`
        );
      }
    });
  }
});

test("secret scanner redacts the fixture credential value", async () => {
  const root = join(PACKAGE_ROOT, "fixtures", "insecure-api");
  const result = await inspectWithTool("scan-secret-patterns", root);
  const serialized = JSON.stringify(result);
  assert.ok(result.findings.length >= 1);
  assert.ok(
    serialized.includes("value redacted") || serialized.includes("value is intentionally redacted")
  );
  assert.ok(!serialized.includes("fixture_token_1234567890"));
});
