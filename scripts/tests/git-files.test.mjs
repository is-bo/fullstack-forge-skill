import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { listWorktreeFiles } from "../lib/git-files.mjs";

const run = promisify(execFile);

test("worktree file listing excludes deleted tracked paths and includes untracked files", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-git-files-"));
  try {
    await run("git", ["init", "--quiet"], { cwd: root, windowsHide: true });
    await writeFile(join(root, "deleted.txt"), "tracked\n", "utf8");
    await writeFile(join(root, "kept.txt"), "tracked\n", "utf8");
    await run("git", ["add", "deleted.txt", "kept.txt"], { cwd: root, windowsHide: true });
    await unlink(join(root, "deleted.txt"));
    await writeFile(join(root, "untracked.txt"), "untracked\n", "utf8");

    assert.deepEqual(listWorktreeFiles(root), ["kept.txt", "untracked.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
