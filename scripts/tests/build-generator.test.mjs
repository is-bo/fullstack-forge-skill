import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  buildRequiredHeadings,
  computeGuidanceCoverage,
  renderBrief,
  renderCommandSkill,
  validateCommandCatalog,
  validateGuidanceMap
} from "../lib/build-generator.mjs";
import { expectedBuildCommands, expectedSlugs, projectRoot } from "../project.mjs";

const run = promisify(execFile);

const sampleEntry = {
  name: "forge-sample",
  title: "Sample",
  description: "Sample build command for testing.",
  purpose: "Purpose paragraph.",
  sections: buildRequiredHeadings
    .slice(1, -1)
    .map((heading) => heading.replace(/^##\s+/u, ""))
    .map((heading) => ({ heading, body: `Body for ${heading}.` }))
};

test("renderCommandSkill is a pure, deterministic function", () => {
  const first = renderCommandSkill(sampleEntry);
  const second = renderCommandSkill(sampleEntry);
  assert.equal(first, second);
  assert.match(
    first,
    /^---\nname: forge-sample\ndescription: Sample build command for testing\.\n---\n/u
  );
  for (const heading of buildRequiredHeadings) assert.ok(first.includes(heading), heading);
  assert.ok(
    first.includes("Never hide failed checks or claim that an operation ran when it did not."),
    "completion contract trailer sentence must be present"
  );
});

test("validateCommandCatalog rejects a catalog out of order or with the wrong name set", () => {
  assert.throws(
    () => validateCommandCatalog([{ ...sampleEntry, name: "forge-new" }], expectedBuildCommands),
    /authoritative build command set in order/u
  );
});

test("validateCommandCatalog rejects a section set that does not match the required headings exactly", () => {
  const broken = {
    ...sampleEntry,
    name: "forge-new",
    sections: sampleEntry.sections.slice(1)
  };
  assert.throws(
    () =>
      validateCommandCatalog(
        [broken, { ...sampleEntry, name: "forge-feature" }],
        ["forge-new", "forge-feature"]
      ),
    /must define exactly/u
  );
});

test("renderBrief enforces the 60-line brief budget", () => {
  const small = renderBrief("cache", {
    title: "Cache",
    decideBeforeCoding: ["Decide one thing."],
    evidenceToProduce: ["Produce one artifact."]
  });
  assert.ok(small.split("\n").length <= 60);

  const oversized = {
    title: "Cache",
    decideBeforeCoding: Array.from({ length: 40 }, (_, i) => `Decision ${i}`),
    evidenceToProduce: Array.from({ length: 40 }, (_, i) => `Evidence ${i}`)
  };
  assert.throws(() => renderBrief("cache", oversized), /60-line brief budget/u);
});

test("validateGuidanceMap rejects a slug that is not an audit module slug", () => {
  assert.throws(
    () =>
      validateGuidanceMap(
        { "not-a-real-slug": { title: "x", decideBeforeCoding: ["a"], evidenceToProduce: ["b"] } },
        expectedSlugs
      ),
    /unknown slug/u
  );
});

test("the real config/build-guidance.json validates cleanly for the entries it has", async () => {
  const guidance = JSON.parse(
    await readFile(join(projectRoot, "config", "build-guidance.json"), "utf8")
  );
  assert.doesNotThrow(() => validateGuidanceMap(guidance, expectedSlugs));
});

test("build-guidance coverage: all 42 briefs are present", async () => {
  // WS-B2 authored hand-written briefs for the 39 slugs beyond WS-B1's 3 exemplars (authorization,
  // cache, ui), completing full coverage. This test fails CI by default whenever
  // config/build-guidance.json regresses to partial coverage (per design-final.md section 6/9)
  // instead of silently shipping an incomplete file.
  const guidance = JSON.parse(
    await readFile(join(projectRoot, "config", "build-guidance.json"), "utf8")
  );
  const coverage = computeGuidanceCoverage(guidance, expectedSlugs);
  assert.deepEqual(
    coverage.missing,
    [],
    `config/build-guidance.json is missing ${coverage.missing.length}/${coverage.total} briefs ` +
      `(pending WS-B2): ${coverage.missing.join(", ")}`
  );
});

test("computeGuidanceCoverage reports exact equality once every expected slug is present", () => {
  const complete = Object.fromEntries(
    expectedSlugs.map((slug) => [
      slug,
      { title: slug, decideBeforeCoding: ["a"], evidenceToProduce: ["b"] }
    ])
  );
  const coverage = computeGuidanceCoverage(complete, expectedSlugs);
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.missing, []);
  assert.equal(coverage.presentCount, expectedSlugs.length);
});

test("generate-build.mjs produces byte-identical output across repeated runs", async (t) => {
  const forgeNewPath = join(
    projectRoot,
    "src",
    "fullstack-forge",
    "commands",
    "forge-new",
    "SKILL.md"
  );
  const before = await readFile(forgeNewPath, "utf8").catch(() => null);
  if (before === null) {
    t.skip("forge-new/SKILL.md has not been generated yet in this checkout");
    return;
  }
  await run("node", ["scripts/generate-build.mjs"], { cwd: projectRoot });
  const afterFirstRun = await readFile(forgeNewPath, "utf8");
  await run("node", ["scripts/generate-build.mjs"], { cwd: projectRoot });
  const afterSecondRun = await readFile(forgeNewPath, "utf8");
  assert.equal(
    afterFirstRun,
    before,
    "re-running the generator must not change already-current output"
  );
  assert.equal(afterSecondRun, afterFirstRun, "two consecutive runs must produce identical output");
});
