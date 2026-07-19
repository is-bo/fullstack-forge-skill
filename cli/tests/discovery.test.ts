import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { discoverProject } from "../src/discovery.js";
import { inspectWithTool } from "../src/inspectors.js";
import { runFile } from "../src/utils.js";
import { copyFixture, withTemporaryProject } from "./helpers.js";

type Expectation = {
  capabilities: string[];
  tools: Record<string, number>;
};

test("all twelve fixtures produce their declared discovery and tool signals", async (t) => {
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
    "risky-fixes",
    "safe-fixes",
    "slow-postgres-app",
    "unsafe-ai-invoice",
    "unsigned-payment-webhook",
    "unverified-backup"
  ]);
  for (const name of fixtureNames) {
    await t.test(name, async () => {
      await withTemporaryProject(`fixture-discovery-${name}`, async (temporary) => {
        const root = join(temporary, "project");
        await copyFixture(join(fixturesRoot, name), root);
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

test("frontend discovery does not imply a public indexable website", async () => {
  await withTemporaryProject("profile-frontend-visibility", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "private-dashboard", dependencies: { react: "0.0.0-fixture" } })}\n`,
      "utf8"
    );
    await writeFile(
      join(root, "Dashboard.tsx"),
      "export const Dashboard = () => <main />;\n",
      "utf8"
    );
    const profile = await discoverProject(root);
    assert.ok(profile.applications.some((application) => application.type === "frontend"));
    assert.equal(profile.capabilities["public-web"], undefined);
  });
});

test("project profile schema v2 records applications, routes, boundaries, and old-profile regeneration", async () => {
  await withTemporaryProject("profile-v2", async (root) => {
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "profile-app", private: true, dependencies: { express: "0.0.0-fixture" } }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(root, "server.ts"),
      `app.get("/dashboard", (_req, res) => res.send("ok"));
app.get("/health", (_req, res) => res.send("ok"));
app.get("/admin", requireRole("admin"), (_req, res) => res.send("ok"));
const tenantId = session.tenantId;
`,
      "utf8"
    );
    const profile = await discoverProject(root);
    assert.equal(profile.schema_version, 2);
    assert.equal(profile.repository.name, "profile-app");
    assert.ok(profile.applications.some((application) => application.type === "backend"));
    assert.equal(
      profile.routes.find((route) => route.name === "GET /dashboard")?.visibility,
      "unknown"
    );
    assert.equal(
      profile.routes.find((route) => route.name === "GET /health")?.visibility,
      "public"
    );
    assert.equal(profile.routes.find((route) => route.name === "GET /admin")?.visibility, "admin");
    assert.ok(profile.tenant_boundaries.length > 0);
    for (const field of [
      "workspaces",
      "applications",
      "languages",
      "frameworks",
      "routes",
      "critical_workflows"
    ] as const) {
      assert.ok(Array.isArray(profile[field]), field);
    }

    await mkdir(join(root, ".forge"));
    await writeFile(
      join(root, ".forge", "project-profile.json"),
      `${JSON.stringify({ schema_version: 1, root, generated_at: new Date().toISOString(), detections: [], capabilities: {} })}\n`,
      "utf8"
    );
    const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
    const result = await runFile(
      process.execPath,
      [cli, "discover", "audit", "--root", root, "--json"],
      root
    );
    assert.equal(result.exitCode, 0, result.stderr);
    const regenerated = JSON.parse(
      await readFile(join(root, ".forge", "project-profile.json"), "utf8")
    ) as { schema_version: number; repository: { name: string; evidence: string[] } };
    assert.equal(regenerated.schema_version, 2);
    assert.equal(regenerated.repository.name, "profile-app");
    assert.equal(
      (
        JSON.parse(
          await readFile(join(root, ".forge", "project-profile.schema-v1.json"), "utf8")
        ) as { schema_version: number }
      ).schema_version,
      1
    );
    assert.ok(regenerated.repository.evidence.some((item) => item.includes("preserved original")));
  });
});
