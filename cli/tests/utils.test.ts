import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { assertSafeRelative, resolveInside, runFile, walkFiles } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

test("portable path validation rejects traversal, Windows roots, devices, and ADS", () => {
  for (const path of [
    "../escape",
    "C:\\Windows\\system32",
    "C:relative",
    "\\\\server\\share",
    "folder/CON.txt",
    "folder/file.txt:stream",
    "folder/trailing."
  ]) {
    assert.throws(() => assertSafeRelative(path), /Unsafe manifest path/u, path);
  }
  assert.doesNotThrow(() => assertSafeRelative(".agents/skills/fullstack-forge/SKILL.md"));
  assert.throws(() => resolveInside(PACKAGE_ROOT, "C:\\outside.txt"), /Unsafe absolute/u);
});

test("subprocess runner applies its timeout", async () => {
  const result = await runFile(
    process.execPath,
    ["-e", "setTimeout(() => {}, 10_000)"],
    PACKAGE_ROOT,
    50
  );
  assert.notEqual(result.exitCode, 0);
});

test("repository walks fail closed when file or byte budgets are exceeded", async () => {
  await withTemporaryProject("walk-budget", async (root) => {
    await writeFile(join(root, "one.txt"), "one", "utf8");
    await writeFile(join(root, "two.txt"), "two", "utf8");
    await assert.rejects(walkFiles(root, { maxFiles: 1 }), /file inspection budget/u);
    await assert.rejects(walkFiles(root, { maxTotalBytes: 5 }), /byte inspection budget/u);
  });
});

test("repository walks never ingest private local audit state", async () => {
  await withTemporaryProject("walk-private", async (root) => {
    await writeFile(join(root, "app.ts"), "export const ok = true;", "utf8");
    for (const directory of [".audit", ".audit-work", ".codex"]) {
      await mkdir(join(root, directory));
      await writeFile(join(root, directory, "private.txt"), "local-only", "utf8");
    }
    const files = await walkFiles(root);
    assert.deepEqual(
      files.map((path) => path.slice(root.length + 1)),
      ["app.ts"]
    );
  });
});
