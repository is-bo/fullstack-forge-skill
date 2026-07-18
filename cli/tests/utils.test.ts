import assert from "node:assert/strict";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import { assertSafeRelative, resolveInside, runFile } from "../src/utils.js";

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
