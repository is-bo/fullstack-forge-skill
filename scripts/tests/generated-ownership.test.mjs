import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import {
  assertGeneratedBuildRuntime,
  generatedBuildRuntimePaths,
  writeGeneratedOwnership
} from "../lib/generated-ownership.mjs";

test("generated ownership rejects hard-linked source files", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-generated-hardlink-"));
  try {
    await mkdir(join(root, "nested"));
    const outside = join(root, "outside.txt");
    const owned = join(root, "nested", "owned.txt");
    await writeFile(outside, "owned");
    try {
      await link(outside, owned);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EXDEV") return;
      throw error;
    }
    await assert.rejects(
      writeGeneratedOwnership(root, "test", ["nested/owned.txt"]),
      /hard-linked|nlink/u
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("generated CLI runtime rejects hard-linked build outputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-build-hardlink-"));
  try {
    const runtimeRoot = join(root, "build", "cli", "src");
    await mkdir(runtimeRoot, { recursive: true });
    for (const path of generatedBuildRuntimePaths())
      await writeFile(join(runtimeRoot, basename(path)), "runtime\n");
    const outside = join(root, "outside.js");
    await writeFile(outside, "outside\n");
    const target = join(runtimeRoot, "index.js");
    await rm(target);
    try {
      await link(outside, target);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EXDEV") return;
      throw error;
    }
    await assert.rejects(assertGeneratedBuildRuntime(root), /hard-linked|nlink/u);
  } finally {
    await rm(root, { recursive: true });
  }
});
