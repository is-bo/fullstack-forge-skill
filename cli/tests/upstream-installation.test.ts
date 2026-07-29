import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { install, readInstallManifest, uninstall } from "../src/installer.js";
import { withTemporaryProject } from "./helpers.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

test("installation delivers the compiled upstream tree and the composition manifests", async () => {
  await withTemporaryProject("upstream-install", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });

    const manifests = join(root, ".fullstack-forge", "manifests");
    assert.ok(await exists(join(manifests, "upstream-registry.json")));
    assert.ok(await exists(join(manifests, "module-composition.json")));
    assert.ok(await exists(join(manifests, "upstream-transforms.json")));
    assert.ok(
      await exists(join(root, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js"))
    );

    const registry = JSON.parse(
      await readFile(join(manifests, "upstream-registry.json"), "utf8")
    ) as { providers: { id: string; runtimeRoot: string }[] };
    assert.equal(registry.providers.length, 8);
    for (const provider of registry.providers) {
      assert.ok(
        await exists(join(root, ".fullstack-forge", "upstream", provider.id)),
        `${provider.id} content is missing from the installation`
      );
    }
  });
});

test("every composition source resolves inside a freshly installed project", async () => {
  await withTemporaryProject("upstream-install-sources", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const composition = JSON.parse(
      await readFile(join(root, ".fullstack-forge", "manifests", "module-composition.json"), "utf8")
    ) as { modules: { module: string; resolvedSources: { runtimePath: string }[] }[] };

    assert.equal(composition.modules.length, 42);
    for (const module of composition.modules) {
      for (const source of module.resolvedSources) {
        assert.ok(
          await exists(join(root, source.runtimePath)),
          `${module.module} references ${source.runtimePath}, which is not installed`
        );
      }
    }
  });
});

test("the installed automatic host path reaches the deterministic composition runner", async () => {
  await withTemporaryProject("upstream-install-runtime-chain", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const orchestrator = await readFile(
      join(root, ".fullstack-forge", "skills", "fullstack-forge", "SKILL.md"),
      "utf8"
    );
    const module = await readFile(
      join(root, ".fullstack-forge", "skills", "forge-observability", "SKILL.md"),
      "utf8"
    );
    const adapter = await readFile(
      join(root, ".claude", "skills", "forge-observability", "SKILL.md"),
      "utf8"
    );

    assert.match(
      orchestrator,
      /\.fullstack-forge\/skills\/forge-<module>\/SKILL\.md/u,
      "the automatic orchestrator must name the canonical module path"
    );
    assert.match(orchestrator, /composition-entry\.js/u);
    assert.match(module, /composition-entry\.js observability compose/u);
    assert.match(adapter, /composition-entry\.js observability compose/u);
    assert.match(module, /load only the ordered\s+`selected` runtime paths/u);
  });
});

test("no installed upstream file is discoverable as a skill by any host", async () => {
  await withTemporaryProject("upstream-install-discovery", async (root) => {
    await install(root, "all", { global: false, dryRun: false });

    const upstream = join(root, ".fullstack-forge", "upstream");
    for (const file of await walk(upstream)) {
      assert.notEqual(
        file.split(/[\\/]/u).pop(),
        "SKILL.md",
        `${file} would be discoverable by an agent host`
      );
    }

    // Host skill roots must contain only Forge's own skills.
    for (const host of [".claude", ".agents", ".cursor", ".gemini", ".github", ".windsurf"]) {
      const skillsRoot = join(root, host, "skills");
      if (!(await exists(skillsRoot))) continue;
      for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
        assert.ok(
          entry.name === "fullstack-forge" || entry.name.startsWith("forge"),
          `${host}/skills/${entry.name} is not a Fullstack Forge skill`
        );
      }
    }
  });
});

test("upstream content is installed once, not duplicated per host", async () => {
  await withTemporaryProject("upstream-install-once", async (root) => {
    await install(root, "all", { global: false, dryRun: false });
    const manifest = await readInstallManifest(root);
    assert.ok(manifest !== undefined);

    const upstreamRecords = Object.keys(manifest.files).filter((path) =>
      path.replace(/\\/gu, "/").startsWith(".fullstack-forge/upstream/")
    );
    assert.ok(upstreamRecords.length > 100);

    const outsideManaged = Object.keys(manifest.files).filter((path) => {
      const posix = path.replace(/\\/gu, "/");
      return posix.includes("/upstream/") && !posix.startsWith(".fullstack-forge/");
    });
    assert.deepEqual(outsideManaged, [], "upstream content must exist in exactly one managed root");
  });
});

test("uninstalling the final host removes the managed upstream tree", async () => {
  await withTemporaryProject("upstream-uninstall", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    assert.ok(await exists(join(root, ".fullstack-forge", "upstream", "impeccable")));

    await uninstall(root, "claude", { global: false, dryRun: false });
    assert.equal(
      await exists(join(root, ".fullstack-forge", "upstream", "impeccable", "PLAYBOOK.md")),
      false,
      "managed upstream content must not be left behind after the last host is removed"
    );
  });
});

test("installed upstream content contains no symlink and no host frontmatter", async () => {
  await withTemporaryProject("upstream-install-safety", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const upstream = join(root, ".fullstack-forge", "upstream");
    for (const file of await walk(upstream)) {
      if (!file.endsWith("PLAYBOOK.md")) continue;
      const text = await readFile(file, "utf8");
      assert.ok(!text.startsWith("---"), `${file} still carries activation frontmatter`);
    }
  });
});
