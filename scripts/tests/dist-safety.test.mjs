import assert from "node:assert/strict";
import { link, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertDistributionInventory } from "../lib/dist-safety.mjs";

test("distribution inventory rejects undeclared files before upload", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-dist-safety-"));
  try {
    const dist = join(root, "dist");
    await mkdir(dist);
    await writeFile(join(dist, "expected.zip"), "expected");
    await assert.doesNotReject(assertDistributionInventory(root, dist, new Set(["expected.zip"])));
    await writeFile(join(dist, "client-notes.txt"), "unexpected");
    await assert.rejects(
      assertDistributionInventory(root, dist, new Set(["expected.zip"])),
      /not declared by this release/u
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("distribution inventory refuses symlink output targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-dist-symlink-"));
  try {
    const dist = join(root, "dist");
    await mkdir(dist);
    const outside = join(root, "outside.tgz");
    await writeFile(outside, "outside");
    try {
      await symlink(outside, join(dist, "release.tgz"), "file");
    } catch (error) {
      if (error?.code === "EPERM") {
        await rm(dist, { recursive: true });
        const outsideDirectory = join(root, "outside-dist");
        await mkdir(outsideDirectory);
        await symlink(outsideDirectory, dist, "junction");
      } else throw error;
    }
    await assert.rejects(
      assertDistributionInventory(root, dist, new Set(["release.tgz"])),
      /symlinked filesystem path/u
    );
  } finally {
    await rm(root, { recursive: true });
  }
});

test("distribution inventory refuses hard-linked output targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-dist-hardlink-"));
  try {
    const dist = join(root, "dist");
    await mkdir(dist);
    const outside = join(root, "outside.tgz");
    const target = join(dist, "release.tgz");
    await writeFile(outside, "outside");
    try {
      await link(outside, target);
    } catch (error) {
      // Filesystems that do not expose hard-link creation cannot exercise this invariant.
      if (error?.code === "EPERM" || error?.code === "EXDEV") return;
      throw error;
    }
    await assert.rejects(
      assertDistributionInventory(root, dist, new Set(["release.tgz"])),
      /hard-linked distribution entry|nlink/u
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
