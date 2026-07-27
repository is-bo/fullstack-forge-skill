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
