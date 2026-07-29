import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { enforceCoverage, parseNodeCoverage } from "../lib/coverage.mjs";
import { collectTestFiles } from "../lib/test-files.mjs";
import { projectRoot } from "../project.mjs";

const sample = `ℹ start of coverage report
ℹ --------------------------------------------------------------
ℹ file          | line % | branch % | funcs % | uncovered lines
ℹ --------------------------------------------------------------
ℹ build         |        |          |         |
ℹ  cli          |        |          |         |
ℹ   src         |        |          |         |
ℹ    gates.js   |  95.00 |    85.00 |   90.00 |
ℹ --------------------------------------------------------------
ℹ all files     |  92.00 |    81.00 |   89.00 |
ℹ --------------------------------------------------------------
ℹ end of coverage report`;

test("Node coverage parser reconstructs nested file paths and overall totals", () => {
  const report = parseNodeCoverage(sample);
  assert.deepEqual(report.overall, { lines: 92, branches: 81, functions: 89 });
  assert.deepEqual(report.files.get("build/cli/src/gates.js"), {
    lines: 95,
    branches: 85,
    functions: 90
  });
});

test("Node coverage parser accepts a mojibake information prefix", () => {
  const mojibake = sample.replaceAll("\u2139", "\u00e2\u201e\u00b9");
  const report = parseNodeCoverage(mojibake);
  assert.deepEqual(report.overall, { lines: 92, branches: 81, functions: 89 });
  assert.equal(report.files.get("build/cli/src/gates.js")?.branches, 85);
});

test("Node coverage parser accepts the TAP comment prefix used by Node 20 and 22", () => {
  const tap = sample.replaceAll("\u2139", "#");
  const report = parseNodeCoverage(tap);
  assert.deepEqual(report.overall, { lines: 92, branches: 81, functions: 89 });
  assert.equal(report.files.get("build/cli/src/gates.js")?.functions, 90);
});

test("Node coverage parser normalizes flat Windows paths emitted by Node 20", () => {
  const windows = sample
    .replace(
      " build         |        |          |         |\nâ„¹  cli          |        |          |         |\nâ„¹   src         |        |          |         |\nâ„¹    gates.js",
      " build\\cli\\src\\gates.js"
    )
    .replaceAll("\u2139", "#");
  const report = parseNodeCoverage(windows);
  assert.equal(report.files.get("build/cli/src/gates.js")?.lines, 95);
});

test("coverage enforcement fails a focused file regression", () => {
  const report = parseNodeCoverage(sample);
  assert.throws(
    () =>
      enforceCoverage(report, {
        overall: { lines: 90, branches: 80, functions: 88 },
        files: {
          "build/cli/src/gates.js": { lines: 96, branches: 80, functions: 90 }
        }
      }),
    /gates\.js lines/u
  );
});

test("the cross-version coverage runner receives explicit deterministic test paths, never globs", async () => {
  const files = await collectTestFiles(projectRoot);
  const portableFiles = files.map((file) => file.replaceAll("\\", "/"));
  assert.ok(files.length > 10);
  assert.deepEqual(files, [...files].sort());
  assert.ok(portableFiles.includes("build/cli/tests/composition.test.js"));
  assert.ok(portableFiles.includes("scripts/tests/coverage.test.mjs"));
  assert.ok(files.every((file) => /\.test\.(?:js|mjs)$/u.test(file)));
  assert.ok(files.every((file) => !/[*?[\]{}]/u.test(file)));
});

test("the cross-version coverage build cannot expose Node 20 to external TypeScript source maps", async () => {
  const tsconfig = JSON.parse(await readFile(join(projectRoot, "tsconfig.json"), "utf8"));
  assert.equal(tsconfig.compilerOptions?.sourceMap, false);
  assert.deepEqual(await sourceMaps(join(projectRoot, "build", "cli")), []);
});

async function sourceMaps(directory) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...(await sourceMaps(path)));
    else if (entry.isFile() && entry.name.endsWith(".js.map")) matches.push(path);
  }
  return matches.sort();
}
