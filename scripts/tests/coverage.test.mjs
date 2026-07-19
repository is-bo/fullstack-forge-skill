import assert from "node:assert/strict";
import test from "node:test";
import { enforceCoverage, parseNodeCoverage } from "../lib/coverage.mjs";

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
