import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import { analyzeChangedScope } from "../src/scope.js";
import { runFile } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

async function git(root: string, args: string[]): Promise<void> {
  const result = await runFile("git", args, root, 30_000);
  assert.equal(result.exitCode, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
}

async function initRepository(root: string): Promise<void> {
  await git(root, ["init", "--initial-branch", "main"]);
  await git(root, ["config", "user.email", "test@example.invalid"]);
  await git(root, ["config", "user.name", "Forge Test"]);
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({ name: "scope-fixture", private: true }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(root, "index.ts"), "export const value = 1;\n", "utf8");
  await git(root, ["add", "-A"]);
  await git(root, ["commit", "-m", "initial"]);
}

/**
 * The previous implementation fell back to "HEAD" when no default branch was found. Because
 * `merge-base HEAD HEAD` is HEAD itself, every committed change on the branch became invisible
 * and the analysis silently implied full coverage of an empty diff.
 */
test("a committed change on a branch is visible against the local default base", async () => {
  await withTemporaryProject("scope-committed", async (root) => {
    await initRepository(root);
    await git(root, ["checkout", "-b", "feature"]);
    await writeFile(join(root, "index.ts"), "export const value = 2;\n", "utf8");
    await git(root, ["add", "-A"]);
    await git(root, ["commit", "-m", "change value"]);

    const profile = await discoverProject(root);
    const scope = await analyzeChangedScope(root, profile);

    assert.notEqual(scope.evidence.base_ref, "HEAD", "HEAD must never be used as a base");
    assert.ok(
      scope.evidence.changed_files.some((file) => file.path === "index.ts"),
      "the committed branch change must appear in the changed set"
    );
  });
});

test("changed scope blocks with a structured error when no base can be resolved", async () => {
  await withTemporaryProject("scope-no-base", async (root) => {
    await git(root, ["init", "--initial-branch", "work"]);
    await git(root, ["config", "user.email", "test@example.invalid"]);
    await git(root, ["config", "user.name", "Forge Test"]);
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "scope-fixture", private: true }, null, 2)}\n`,
      "utf8"
    );
    await git(root, ["add", "-A"]);
    await git(root, ["commit", "-m", "initial"]);

    const profile = await discoverProject(root);
    await assert.rejects(
      () => analyzeChangedScope(root, profile),
      (error: Error) => {
        assert.match(error.message, /BLOCKED/u, "the failure must be an explicit BLOCKED result");
        assert.match(error.message, /--base/u, "the operator must be told how to proceed");
        return true;
      },
      "with no main, master, origin, or upstream the analysis must block rather than compare HEAD to itself"
    );
  });
});

test("an explicit --base still takes precedence over every default", async () => {
  await withTemporaryProject("scope-explicit-base", async (root) => {
    await initRepository(root);
    const baseCommit = (await runFile("git", ["rev-parse", "HEAD"], root, 30_000)).stdout.trim();
    await git(root, ["checkout", "-b", "feature"]);
    await writeFile(join(root, "index.ts"), "export const value = 3;\n", "utf8");
    await git(root, ["add", "-A"]);
    await git(root, ["commit", "-m", "change"]);

    const profile = await discoverProject(root);
    const scope = await analyzeChangedScope(root, profile, baseCommit);
    assert.equal(scope.evidence.base_ref, baseCommit);
    assert.ok(scope.evidence.changed_files.some((file) => file.path === "index.ts"));
  });
});

test("the branch upstream is preferred over a local default branch", async () => {
  await withTemporaryProject("scope-upstream", async (root) => {
    await initRepository(root);
    // A local "remote" branch the feature branch tracks.
    await git(root, ["branch", "release"]);
    await git(root, ["checkout", "-b", "feature"]);
    await git(root, ["branch", "--set-upstream-to", "release"]);
    await writeFile(join(root, "index.ts"), "export const value = 4;\n", "utf8");
    await git(root, ["add", "-A"]);
    await git(root, ["commit", "-m", "change"]);

    const profile = await discoverProject(root);
    const scope = await analyzeChangedScope(root, profile);
    assert.equal(
      scope.evidence.base_ref,
      "release",
      "the configured upstream must win over the local main branch"
    );
  });
});
