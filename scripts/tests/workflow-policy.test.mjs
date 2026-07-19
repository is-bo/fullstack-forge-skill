import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { validateWorkflowPolicies } from "../lib/workflow-policy.mjs";
import { projectRoot } from "../project.mjs";

test("repository workflows satisfy immutable action and release policy", async () => {
  const workflows = Object.fromEntries(
    await Promise.all(
      ["ci.yml", "codeql.yml", "release.yml"].map(async (name) => [
        name,
        await readFile(join(projectRoot, ".github", "workflows", name), "utf8")
      ])
    )
  );
  assert.deepEqual(validateWorkflowPolicies(workflows), []);
});

test("workflow policy rejects mutable actions and clobbering", () => {
  const errors = validateWorkflowPolicies({
    "ci.yml": "on: pull_request_target\nsteps:\n  - uses: actions/checkout@v7\n",
    "release.yml": "gh release upload --clobber\n",
    "codeql.yml": ""
  });
  assert.ok(errors.some((error) => error.includes("pull_request_target")));
  assert.ok(errors.some((error) => error.includes("full commit SHA")));
  assert.ok(errors.some((error) => error.includes("clobbering")));
});
