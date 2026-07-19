import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectFixtureManifests } from "../lib/fixture-manifests.mjs";
import { projectRoot } from "../project.mjs";

test("repository fixtures contain only non-installable sentinel manifests", async () => {
  const result = await inspectFixtureManifests(join(projectRoot, "fixtures"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifests.length, 12);
});

test("fixture validation rejects installable manifests and genuine versions", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "forge-fixture-manifests-"));
  const fixtures = join(temporary, "fixtures");
  const sample = join(fixtures, "sample");
  try {
    await mkdir(sample, { recursive: true });
    await writeFile(join(sample, "package.json"), "{}\n");
    await writeFile(join(sample, "composer.json"), "{}\n");
    await writeFile(
      join(sample, "package.json.fixture"),
      JSON.stringify({
        name: "fixture-sample",
        version: "1.0.0",
        private: true,
        dependencies: { express: "5.0.0" }
      })
    );
    const result = await inspectFixtureManifests(fixtures);
    assert.ok(result.errors.length >= 4);
    assert.ok(result.errors.some((error) => error.includes("installable manifests")));
    assert.ok(result.errors.some((error) => error.includes("0.0.0-fixture")));
    assert.ok(result.errors.some((error) => error.includes("unsupported sentinel fields")));
  } finally {
    await rm(temporary, { recursive: true });
  }
});
