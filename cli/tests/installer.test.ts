import assert from "node:assert/strict";
import { mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { install, readInstallManifest, uninstall } from "../src/installer.js";
import { withTemporaryProject } from "./helpers.js";

test("dry-run, install, update, and uninstall honor ownership", async () => {
  await withTemporaryProject("lifecycle", async (root) => {
    const planned = await install(root, "generic", { global: false, dryRun: true });
    assert.ok(planned.length > 40);
    await assert.rejects(stat(join(root, ".agents")), { code: "ENOENT" });

    const created = await install(root, "generic", { global: false, dryRun: false });
    assert.ok(created.every((action) => action.action === "create"));
    const master = join(root, ".agents", "skills", "fullstack-forge", "SKILL.md");
    assert.match(await readFile(master, "utf8"), /# Fullstack Forge/u);
    const manifest = await readInstallManifest(root);
    assert.ok(manifest !== undefined && Object.keys(manifest.files).length > 40);

    const updated = await install(root, "codex", { global: false, dryRun: false });
    assert.ok(updated.every((action) => action.action === "preserve-identical"));
    const removed = await uninstall(root, "antigravity", { global: false, dryRun: false });
    assert.ok(removed.some((action) => action.action === "remove"));
    await assert.rejects(stat(master), { code: "ENOENT" });
  });
});

test("installer refuses unowned conflicts before any managed writes", async () => {
  await withTemporaryProject("conflict", async (root) => {
    const conflict = join(root, ".agents", "skills", "fullstack-forge", "SKILL.md");
    await mkdir(join(root, ".agents", "skills", "fullstack-forge"), { recursive: true });
    await writeFile(conflict, "user-owned\n", "utf8");
    await assert.rejects(
      install(root, "generic", { global: false, dryRun: false }),
      /unowned file/u
    );
    assert.equal(await readFile(conflict, "utf8"), "user-owned\n");
    assert.equal(await readInstallManifest(root), undefined);
  });
});

test("uninstall preserves a modified owned file", async () => {
  await withTemporaryProject("modified", async (root) => {
    await install(root, "generic", { global: false, dryRun: false });
    const master = join(root, ".agents", "skills", "fullstack-forge", "SKILL.md");
    await writeFile(master, "user modification\n", "utf8");
    const actions = await uninstall(root, "generic", { global: false, dryRun: false });
    assert.ok(
      actions.some(
        (action) => action.action === "preserve-modified" && action.path.endsWith("SKILL.md")
      )
    );
    assert.equal(await readFile(master, "utf8"), "user modification\n");
  });
});

test("manifest traversal is rejected", async () => {
  await withTemporaryProject("traversal", async (root) => {
    await mkdir(join(root, ".fullstack-forge"));
    await writeFile(
      join(root, ".fullstack-forge", "install-manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        packageVersion: "0.1.1",
        root,
        installedAt: new Date().toISOString(),
        files: { "../escape": { hash: "a".repeat(64), platform: "agents", owned: true } }
      })
    );
    await assert.rejects(
      uninstall(root, "generic", { global: false, dryRun: false }),
      /Unsafe manifest path/u
    );
  });
});

test("installer refuses a symlinked destination component", async (t) => {
  await withTemporaryProject("symlink", async (root) => {
    const outside = join(root, "outside");
    await mkdir(outside);
    try {
      await symlink(
        outside,
        join(root, ".agents"),
        process.platform === "win32" ? "junction" : "dir"
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("Creating a test symlink requires OS privilege");
        return;
      }
      throw error;
    }
    await assert.rejects(
      install(root, "generic", { global: false, dryRun: false }),
      /symlinked install destination/u
    );
  });
});

test("Antigravity and Gemini project/global destinations remain product-specific", async () => {
  await withTemporaryProject("platform-destinations", async (root) => {
    const projectActions = await install(root, "antigravity", {
      global: false,
      dryRun: false
    });
    assert.ok(projectActions.some((action) => action.path.startsWith(".agents/skills/")));
    await stat(join(root, ".agents", "skills", "fullstack-forge", "SKILL.md"));
    await uninstall(root, "antigravity", { global: false, dryRun: false });

    const antigravityGlobal = await install(root, "antigravity", {
      global: true,
      dryRun: false,
      home: root
    });
    assert.ok(antigravityGlobal.some((action) => action.path.startsWith(".gemini/config/skills/")));
    await stat(join(root, ".gemini", "config", "skills", "fullstack-forge", "SKILL.md"));
    await uninstall(root, "antigravity", {
      global: true,
      dryRun: false,
      home: root
    });

    const geminiGlobal = await install(root, "gemini", {
      global: true,
      dryRun: false,
      home: root
    });
    assert.ok(geminiGlobal.some((action) => action.path.startsWith(".gemini/skills/")));
    assert.ok(geminiGlobal.every((action) => !action.path.startsWith(".gemini/config/skills/")));
    await uninstall(root, "gemini", { global: true, dryRun: false, home: root });

    const genericGlobal = await install(root, "generic", {
      global: true,
      dryRun: false,
      home: root
    });
    assert.ok(genericGlobal.some((action) => action.path.startsWith(".agents/skills/")));
  });
});
