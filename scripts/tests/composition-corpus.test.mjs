import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();

test("the composition corpus covers the 25 required evaluation scenarios", () => {
  const corpus = JSON.parse(
    readFileSync(join(projectRoot, "ff-eval", "composition-corpus.json"), "utf8")
  );
  assert.equal(corpus.cases.length, 25);
  const ids = corpus.cases.map((entry) => entry.id);
  assert.equal(new Set(ids).size, 25);
  for (const entry of corpus.cases) {
    assert.ok(entry.modules.length > 0, `${entry.id} selects no module`);
    assert.ok(Array.isArray(entry.expectActive));
    assert.ok(Array.isArray(entry.expectSuppressed));
  }
});

test("every corpus case activates and suppresses exactly what it declares", () => {
  const output = execFileSync(
    process.execPath,
    [join("scripts", "run-composition-eval.mjs"), "--json"],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  const report = JSON.parse(output);
  assert.equal(report.summary.cases, 25);
  assert.equal(report.summary.failed, 0);
  for (const row of report.results) {
    assert.deepEqual(row.missingExpected, [], `${row.id} did not activate expected content`);
    assert.deepEqual(row.wronglyActive, [], `${row.id} leaked suppressed provider content`);
  }
  // Evidence gating must actually suppress across the corpus, not merely be declared.
  assert.ok(report.summary.totalSuppressedAcrossCorpus > 50);
  assert.ok(report.summary.casesWithNoProviderContent >= 2);
});

test("the published evaluation figures match what the harness actually reports", () => {
  // The evaluation document's whole purpose is to be the honesty record, including the fact that
  // the context-budget target is missed. A stale table there is worse than no table, so the
  // published numbers are asserted against the live harness rather than trusted.
  const output = execFileSync(
    process.execPath,
    [join("scripts", "run-composition-eval.mjs"), "--json"],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  const { summary } = JSON.parse(output);
  const document = readFileSync(join(projectRoot, "ff-eval", "COMPOSITION_EVALUATION.md"), "utf8");

  const documented = (label) => {
    const match = new RegExp(`\\|\\s*${label}\\s*\\|\\s*\\+?(\\d+)%?\\s*\\|`, "u").exec(document);
    assert.ok(match !== null, `${label} is not published in the evaluation table`);
    return Number(match[1]);
  };

  assert.equal(documented("Cases"), summary.cases);
  assert.equal(documented("Sources correctly suppressed"), summary.totalSuppressedAcrossCorpus);
  assert.equal(documented("Cases loading no provider content"), summary.casesWithNoProviderContent);
  for (const [label, value] of [
    ["Median eager context increase", summary.medianEagerPercentIncrease],
    ["Maximum eager context increase", summary.maxEagerPercentIncrease],
    ["Median available context increase", summary.medianAvailablePercentIncrease],
    ["Maximum available context increase", summary.maxAvailablePercentIncrease]
  ]) {
    // Published to the nearest whole percent; never rounded in the flattering direction by more
    // than that.
    assert.equal(
      documented(label),
      Math.round(value),
      `${label} published as ${documented(label)}% but measured ${value}%`
    );
  }
});
