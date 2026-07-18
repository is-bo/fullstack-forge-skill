import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertNoSymlinkPath, assertSafeRelativePath } from "../lib/fs-safety.mjs";

test("script path safety rejects cross-platform escape forms", () => {
  for (const path of ["../escape", "C:\\escape", "\\\\server\\share", "CON.txt", "a:b"])
    assert.throws(() => assertSafeRelativePath(path), /Unsafe relative/u);
  assert.doesNotThrow(() => assertSafeRelativePath("fullstack-forge/SKILL.md"));
});

test("script path safety rejects symlinked destination components", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-path-test-"));
  try {
    const outside = join(root, "outside");
    await mkdir(outside);
    try {
      await symlink(
        outside,
        join(root, "managed"),
        process.platform === "win32" ? "junction" : "dir"
      );
    } catch (error) {
      if (error?.code === "EPERM") {
        t.skip("Creating a test symlink requires OS privilege");
        return;
      }
      throw error;
    }
    await assert.rejects(assertNoSymlinkPath(root, join(root, "managed", "file")), /symlinked/u);
  } finally {
    await rm(root, { recursive: true });
  }
});
