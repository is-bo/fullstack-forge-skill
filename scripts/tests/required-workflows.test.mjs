import assert from "node:assert/strict";
import test from "node:test";
import { verifyRequiredWorkflowRuns } from "../lib/required-workflows.mjs";

const sha = "a".repeat(40);
const workflowPath = (name) =>
  name === "CI" ? ".github/workflows/ci.yml" : ".github/workflows/codeql.yml";
const run = (name, overrides = {}) => ({
  id: name === "CI" ? 1 : 2,
  name,
  path: workflowPath(name),
  head_sha: sha,
  event: "push",
  status: "completed",
  conclusion: "success",
  ...overrides
});

test("exact-SHA push workflow evidence must be complete and successful", () => {
  const result = verifyRequiredWorkflowRuns(
    [[{ workflow_runs: [run("CI")] }], [{ workflow_runs: [run("CodeQL")] }]],
    { sha, required: ["CI", "CodeQL"] }
  );
  assert.deepEqual(
    result.workflows.map((entry) => entry.name),
    ["CI", "CodeQL"]
  );
});

test("missing, pending, failed, and wrong-boundary runs fail closed", () => {
  assert.throws(
    () =>
      verifyRequiredWorkflowRuns([{ workflow_runs: [run("CI")] }], { sha, required: ["CodeQL"] }),
    /no exact-SHA/u
  );
  for (const overrides of [
    { status: "in_progress", conclusion: null },
    { conclusion: "failure" },
    { head_sha: "b".repeat(40) },
    { event: "pull_request" }
  ])
    assert.throws(
      () =>
        verifyRequiredWorkflowRuns([{ workflow_runs: [run("CI", overrides)] }], {
          sha,
          required: ["CI"]
        }),
      /not completed|outside/u
    );
});

test("malformed responses and duplicate requirements are rejected", () => {
  assert.throws(
    () => verifyRequiredWorkflowRuns({}, { sha, required: ["CI"] }),
    /not a JSON array/u
  );
  assert.throws(
    () =>
      verifyRequiredWorkflowRuns([{ workflow_runs: [{ name: "CI" }] }], { sha, required: ["CI"] }),
    /malformed run/u
  );
  assert.throws(
    () =>
      verifyRequiredWorkflowRuns([{ workflow_runs: [run("CI"), run("CI", { id: 1 })] }], {
        sha,
        required: ["CI"]
      }),
    /duplicate run IDs/u
  );
  assert.throws(
    () => verifyRequiredWorkflowRuns([], { sha, required: ["CI", "CI"] }),
    /duplicated/u
  );
});

test("required workflow evidence binds display names to exact workflow paths", () => {
  assert.throws(
    () =>
      verifyRequiredWorkflowRuns(
        [{ workflow_runs: [run("CI", { path: ".github/workflows/not-ci.yml" })] }],
        { sha, required: ["CI"] }
      ),
    /wrong workflow identity/u
  );
  assert.doesNotThrow(() =>
    verifyRequiredWorkflowRuns(
      [{ workflow_runs: [run("Build", { path: ".github/workflows/build.yml@main" })] }],
      {
        sha,
        required: [{ name: "Build", path: ".github/workflows/build.yml" }]
      }
    )
  );
  assert.throws(
    () =>
      verifyRequiredWorkflowRuns([{ workflow_runs: [run("Build")] }], { sha, required: ["Build"] }),
    /must declare an exact workflow path/u
  );
  assert.throws(
    () =>
      verifyRequiredWorkflowRuns(
        [{ workflow_runs: [run("CI", { path: ".github/workflows/ci.yml", workflow_id: 7 })] }],
        { sha, required: [{ name: "CI", path: ".github/workflows/ci.yml", workflowId: 8 }] }
      ),
    /wrong workflow identity/u
  );
});
