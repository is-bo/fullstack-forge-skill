import assert from "node:assert/strict";
import { mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { PROJECT_INSTRUCTIONS, extractManagedSection } from "../src/automatic-activation.js";
import { PACKAGE_ROOT, VERSION } from "../src/constants.js";
import { install, normalizePlatforms, readInstallManifest, uninstall } from "../src/installer.js";
import { runFile, sha256 } from "../src/utils.js";
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
    assert.equal(
      Object.keys(manifest.files).some((path) => path.endsWith(".fullstack-forge-generated.json")),
      false
    );
    await assert.rejects(
      stat(join(root, ".fullstack-forge", "upstream", ".fullstack-forge-generated.json")),
      { code: "ENOENT" }
    );
    assert.equal(manifest.agent_first, true);
    assert.equal(manifest.automatic_activation, true);
    assert.match(await readFile(join(root, "AGENTS.md"), "utf8"), /automatic activation/u);

    const updated = await install(root, "codex", { global: false, dryRun: false });
    assert.ok(updated.every((action) => action.action === "preserve-identical"));
    const removed = await uninstall(root, "antigravity", { global: false, dryRun: false });
    assert.ok(removed.some((action) => action.action === "remove"));
    await assert.rejects(stat(master), { code: "ENOENT" });
  });
});

test("update rejects stale canonical paths outside the bundled inventory", async () => {
  await withTemporaryProject("stale-canonical", async (root) => {
    await install(root, "generic", { global: false, dryRun: false });
    const manifest = await readInstallManifest(root);
    assert.ok(manifest);
    const cleanRelative = ".fullstack-forge/skills/retired-clean/SKILL.md";
    const modifiedRelative = ".fullstack-forge/skills/retired-modified/SKILL.md";
    const cleanBytes = Buffer.from("retired clean canonical\n", "utf8");
    const originalModifiedBytes = Buffer.from("retired original canonical\n", "utf8");
    for (const [relative, bytes] of [
      [cleanRelative, cleanBytes],
      [modifiedRelative, originalModifiedBytes]
    ] as const) {
      const target = join(root, ...relative.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      manifest.files[relative] = {
        hash: sha256(bytes),
        platform: "agents",
        platforms: ["agents"],
        owned: true,
        kind: "canonical"
      };
    }
    await writeFile(
      join(root, ".fullstack-forge", "install-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    const userBytes = Buffer.from("user changed retired canonical\n", "utf8");
    await writeFile(join(root, ...modifiedRelative.split("/")), userBytes);

    await assert.rejects(
      install(root, "generic", { global: false, dryRun: false }),
      /outside Fullstack Forge managed paths/u
    );
    assert.deepEqual(await readFile(join(root, ...cleanRelative.split("/"))), cleanBytes);
    assert.deepEqual(await readFile(join(root, ...modifiedRelative.split("/"))), userBytes);
  });
});

test("managed project instructions preserve user content across install, update, and uninstall", async () => {
  await withTemporaryProject("managed-instructions", async (root) => {
    const instructions = join(root, "AGENTS.md");
    await writeFile(instructions, "# User instructions\n\nKeep this paragraph.\n", "utf8");

    await install(root, "codex", { global: false, dryRun: false });
    const installed = await readFile(instructions, "utf8");
    assert.match(installed, /Keep this paragraph\./u);
    assert.match(installed, /fullstack-forge:automatic-activation:start/u);
    assert.match(
      installed,
      /UNDERSTAND, DISCOVER, SELECT, PLAN, IMPLEMENT, INSPECT, VERIFY, REPORT/u
    );
    const manifest = await readInstallManifest(root);
    assert.ok(manifest);
    const instructionRecord = manifest.files["AGENTS.md"];
    assert.ok(instructionRecord);
    assert.equal(instructionRecord.management, "section");
    assert.equal(instructionRecord.owned, true);

    await writeFile(
      instructions,
      installed.replace("Keep this paragraph.", "Keep this updated paragraph."),
      "utf8"
    );
    await install(root, "codex", { global: false, dryRun: false });
    assert.match(await readFile(instructions, "utf8"), /Keep this updated paragraph\./u);

    await uninstall(root, "codex", { global: false, dryRun: false });
    const remaining = await readFile(instructions, "utf8");
    assert.equal(remaining, "# User instructions\n\nKeep this updated paragraph.\n");
    assert.doesNotMatch(remaining, /fullstack-forge/u);
  });
});

test("managed project instructions safely adopt an existing empty instruction file", async () => {
  await withTemporaryProject("empty-managed-instructions", async (root) => {
    const instructions = join(root, "AGENTS.md");
    await writeFile(instructions, "", "utf8");

    await install(root, "codex", { global: false, dryRun: false });

    assert.match(await readFile(instructions, "utf8"), /automatic activation/u);
  });
});

test("partial uninstall clears activation status when only modified skill files remain", async () => {
  await withTemporaryProject("partial-uninstall-activation", async (root) => {
    await install(root, "cursor", { global: false, dryRun: false });
    const master = join(root, ".cursor", "skills", "fullstack-forge", "SKILL.md");
    await writeFile(master, "user modification\n", "utf8");

    await uninstall(root, "cursor", { global: false, dryRun: false });

    const manifest = await readInstallManifest(root);
    assert.ok(manifest);
    assert.equal(manifest.automatic_activation, false);
    await assert.rejects(stat(join(root, ".cursor", "rules", "fullstack-forge.mdc")), {
      code: "ENOENT"
    });
    assert.equal(await readFile(master, "utf8"), "user modification\n");
  });
});

test("managed project instructions refuse modified Forge-owned sections", async () => {
  await withTemporaryProject("modified-instructions", async (root) => {
    await install(root, "codex", { global: false, dryRun: false });
    const instructions = join(root, "AGENTS.md");
    const installed = await readFile(instructions, "utf8");
    await writeFile(
      instructions,
      installed.replace("Use Forge proportionately", "Disable Forge proportionately"),
      "utf8"
    );

    await assert.rejects(
      install(root, "codex", { global: false, dryRun: false }),
      /modified owned section/u
    );
    const actions = await uninstall(root, "codex", { global: false, dryRun: false });
    assert.ok(
      actions.some((action) => action.action === "preserve-modified" && action.path === "AGENTS.md")
    );
    assert.match(await readFile(instructions, "utf8"), /Disable Forge proportionately/u);
  });
});

test("uninstall preserves a managed instruction file with malformed ownership markers", async () => {
  await withTemporaryProject("malformed-instructions", async (root) => {
    await install(root, "codex", { global: false, dryRun: false });
    const instructions = join(root, "AGENTS.md");
    const malformed = (await readFile(instructions, "utf8")).replace(
      "<!-- fullstack-forge:automatic-activation:end -->",
      ""
    );
    await writeFile(instructions, malformed, "utf8");

    const actions = await uninstall(root, "codex", { global: false, dryRun: false });

    assert.ok(
      actions.some((action) => action.action === "preserve-modified" && action.path === "AGENTS.md")
    );
    assert.equal(await readFile(instructions, "utf8"), malformed);
  });
});

test("all project platforms receive their official managed instruction shape", async () => {
  await withTemporaryProject("platform-instructions", async (root) => {
    await install(root, "all", { global: false, dryRun: false });
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".cursor/rules/fullstack-forge.mdc",
      ".windsurf/rules/fullstack-forge.md",
      ".github/instructions/fullstack-forge.instructions.md"
    ]) {
      assert.match(await readFile(join(root, ...path.split("/")), "utf8"), /automatic activation/u);
    }
  });
});

test("a detected-host selector installs only the requested finite host set", async () => {
  assert.deepEqual(normalizePlatforms("claude,cursor,claude"), ["claude", "cursor"]);
  await withTemporaryProject("detected-host-footprint", async (root) => {
    const selected = await install(root, "claude,cursor", { global: false, dryRun: false });
    const selectedManifest = await readInstallManifest(root);
    assert.ok(selectedManifest);
    assert.deepEqual(
      new Set(Object.values(selectedManifest.files).map((file) => file.platform)),
      new Set(["claude", "cursor"])
    );
    // Host adapters live under the selected host roots; the single managed copy they point at
    // lives under the shared canonical root. No unselected host may be touched.
    assert.ok(
      selected.every(
        (action) =>
          action.path === "CLAUDE.md" ||
          action.path.startsWith(".claude/") ||
          action.path.startsWith(".cursor/") ||
          action.path.startsWith(".fullstack-forge/")
      ),
      `unexpected install path: ${selected.map((action) => action.path).join(", ")}`
    );
    for (const unselected of [".agents/", ".gemini/", ".github/", ".windsurf/"])
      assert.ok(
        selected.every((action) => !action.path.startsWith(unselected)),
        `${unselected} must not be installed by a claude,cursor selector`
      );

    const all = await install(root, "all", { global: false, dryRun: true });
    assert.ok(selected.length < all.length);
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

test("schema-1 manifests retain only exact legacy instruction ownership", async () => {
  await withTemporaryProject("legacy-instruction-manifest", async (root) => {
    const agentsInstruction = PROJECT_INSTRUCTIONS.agents;
    const claudeInstruction = PROJECT_INSTRUCTIONS.claude;
    assert.ok(agentsInstruction && claudeInstruction);
    const agentsSection = extractManagedSection(agentsInstruction.content);
    const claudeSection = extractManagedSection(claudeInstruction.content);
    assert.ok(agentsSection && claudeSection);
    await writeFile(join(root, "AGENTS.md"), agentsInstruction.content, "utf8");
    await writeFile(join(root, "CLAUDE.md"), claudeInstruction.content, "utf8");
    await mkdir(join(root, ".fullstack-forge"), { recursive: true });
    await writeFile(
      join(root, ".fullstack-forge", "install-manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          packageVersion: "0.1.0",
          root,
          installedAt: new Date().toISOString(),
          agent_first: true,
          automatic_activation: true,
          files: {
            "AGENTS.md": {
              hash: sha256(agentsSection),
              platform: "agents",
              owned: true,
              management: "section"
            },
            "CLAUDE.md": {
              hash: sha256(claudeSection),
              platform: "claude",
              owned: true,
              management: "section"
            }
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await install(root, "codex", { global: false, dryRun: false });
    const migrated = await readInstallManifest(root);
    assert.equal(migrated?.schemaVersion, 2);
    assert.equal(migrated.files["AGENTS.md"]!.kind, "instructions");
    assert.equal(migrated.files["CLAUDE.md"]!.kind, "instructions");
    await install(root, "claude", { global: false, dryRun: false });
  });
});

test("schema-1 global manifests retain an exact adapter host for bare update", async () => {
  await withTemporaryProject("legacy-global-host", async (root) => {
    await install(root, "claude", { global: true, home: root, dryRun: false });
    const manifestPath = join(root, ".fullstack-forge", "install-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      schemaVersion: number;
      files: Record<string, { kind?: string; platforms?: string[] }>;
    };
    manifest.schemaVersion = 1;
    for (const record of Object.values(manifest.files)) {
      delete record.kind;
      delete record.platforms;
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const cli = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    process.env.HOME = root;
    process.env.USERPROFILE = root;
    let updated: Awaited<ReturnType<typeof runFile>>;
    try {
      updated = await runFile(
        process.execPath,
        [cli, "update", "--global", "--root", root, "--json"],
        root
      );
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = previousUserProfile;
    }
    assert.equal(updated.exitCode, 0, updated.stderr);
    assert.equal((JSON.parse(updated.stdout) as { selector: string }).selector, "claude");
  });
});

test("a forged manifest cannot claim and delete arbitrary project files", async () => {
  for (const operation of ["update", "uninstall"] as const) {
    for (const fixture of [
      { relative: "package.json", schemaVersion: 2, kind: "adapter" },
      { relative: "AGENTS.md", schemaVersion: 2, kind: "adapter" },
      { relative: ".agents/skills/user-owned/SKILL.md", schemaVersion: 2, kind: "adapter" },
      {
        relative: ".fullstack-forge/skills/fullstack-forge/forged.txt",
        schemaVersion: 2,
        kind: "canonical"
      },
      {
        relative: ".fullstack-forge/upstream/forged.txt",
        schemaVersion: 2,
        kind: "canonical"
      },
      {
        relative: ".fullstack-forge/skills/fullstack-forge/SKILL.md",
        schemaVersion: 2,
        kind: "canonical"
      },
      {
        relative: ".fullstack-forge/upstream/addy-agent-skills/UPSTREAM-SOURCE.md",
        schemaVersion: 2,
        kind: "canonical"
      },
      { relative: ".agents/skills/forge/SKILL.md", schemaVersion: 2, kind: "adapter" },
      {
        relative: ".agents/skills/fullstack-forge/references/forged.txt",
        schemaVersion: 1
      }
    ] as const) {
      const { relative, schemaVersion, kind } = fixture;
      await withTemporaryProject(
        `forged-ownership-${operation}-${relative.replace(/[^a-z]+/giu, "-")}`,
        async (root) => {
          const bytes = Buffer.from(`user-owned ${relative}\n`, "utf8");
          const target = join(root, ...relative.split("/"));
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, bytes);
          await mkdir(join(root, ".fullstack-forge"), { recursive: true });
          await writeFile(
            join(root, ".fullstack-forge", "install-manifest.json"),
            `${JSON.stringify(
              {
                schemaVersion,
                packageVersion: "0.2.2",
                root,
                installedAt: new Date().toISOString(),
                agent_first: true,
                automatic_activation: true,
                files: {
                  [relative]: {
                    hash: sha256(bytes),
                    platform: "agents",
                    owned: true,
                    management: "file",
                    ...(kind === undefined ? {} : { kind })
                  }
                }
              },
              null,
              2
            )}\n`,
            "utf8"
          );

          const action =
            operation === "update"
              ? install(root, "generic", { global: false, dryRun: false })
              : uninstall(root, "generic", { global: false, dryRun: false });
          await assert.rejects(
            action,
            /outside Fullstack Forge managed paths|hash does not match bundled managed content/u
          );
          assert.deepEqual(await readFile(target), bytes);
        }
      );
    }
  }
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

test("installer refuses a symlinked ownership manifest", async (t) => {
  await withTemporaryProject("manifest-symlink", async (root) => {
    const outside = join(root, "outside-manifest.json");
    await writeFile(outside, "{}", "utf8");
    await mkdir(join(root, ".fullstack-forge"), { recursive: true });
    try {
      await symlink(outside, join(root, ".fullstack-forge", "install-manifest.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("Creating a test symlink requires OS privilege");
        return;
      }
      throw error;
    }
    await assert.rejects(readInstallManifest(root), /symlinked install destination/u);
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

test("an interruption after ownership preparation resumes without orphaning files", async () => {
  await withTemporaryProject("interrupted-before-write", async (root) => {
    await assert.rejects(
      install(root, "generic", {
        global: false,
        dryRun: false,
        interruptAfter: 0
      }),
      /interruption after ownership preparation/u
    );
    const prepared = await readInstallManifest(root);
    assert.ok(prepared !== undefined);
    assert.ok(Object.keys(prepared.files).length > 40);
    assert.ok(Object.values(prepared.files).every((record) => record.owned));

    const resumed = await install(root, "generic", { global: false, dryRun: false });
    assert.ok(resumed.every((action) => action.action === "create"));
    const master = join(root, ".agents", "skills", "fullstack-forge", "SKILL.md");
    await stat(master);
    const removed = await uninstall(root, "generic", { global: false, dryRun: false });
    assert.ok(removed.some((action) => action.path.endsWith("fullstack-forge/SKILL.md")));
    await assert.rejects(stat(master), { code: "ENOENT" });
  });
});

test("an interruption after a managed write safely adopts only prepared owned paths", async () => {
  await withTemporaryProject("interrupted-after-write", async (root) => {
    await assert.rejects(
      install(root, "generic", {
        global: false,
        dryRun: false,
        interruptAfter: 1
      }),
      /interruption after 1 managed write/u
    );
    const prepared = await readInstallManifest(root);
    assert.ok(prepared !== undefined);
    assert.ok(Object.values(prepared.files).every((record) => record.owned));

    const resumed = await install(root, "generic", { global: false, dryRun: false });
    assert.ok(resumed.some((action) => action.action === "preserve-identical"));
    assert.ok(resumed.some((action) => action.action === "create"));
    const completed = await readInstallManifest(root);
    assert.ok(completed !== undefined);
    assert.ok(Object.values(completed.files).every((record) => record.owned));
  });
});

test("crash recovery never adopts a pre-existing identical unowned file", async () => {
  await withTemporaryProject("interrupted-unowned-identical", async (root) => {
    const bundled = join(PACKAGE_ROOT, ".agents", "skills", "fullstack-forge", "SKILL.md");
    const target = join(root, ".agents", "skills", "fullstack-forge", "SKILL.md");
    await mkdir(join(root, ".agents", "skills", "fullstack-forge"), { recursive: true });
    await writeFile(target, await readFile(bundled));

    await assert.rejects(
      install(root, "generic", {
        global: false,
        dryRun: false,
        interruptAfter: 0
      }),
      /interruption after ownership preparation/u
    );
    const prepared = await readInstallManifest(root);
    assert.ok(prepared !== undefined);
    const relative = ".agents/skills/fullstack-forge/SKILL.md";
    assert.equal(prepared.files[relative], undefined);

    await install(root, "generic", { global: false, dryRun: false });
    const completed = await readInstallManifest(root);
    assert.equal(completed?.files[relative]?.owned, false);
    await uninstall(root, "generic", { global: false, dryRun: false });
    assert.match(await readFile(target, "utf8"), /# Fullstack Forge/u);
  });
});

test("an interrupted previous-release update resumes from either the old or new hash", async () => {
  await withTemporaryProject("interrupted-upgrade", async (root) => {
    await install(root, "generic", { global: false, dryRun: false });
    const relative = ".agents/skills/fullstack-forge/SKILL.md";
    const target = join(root, ...relative.split("/"));
    const manifestPath = join(root, ".fullstack-forge", "install-manifest.json");
    const previousBytes = await readFile(
      join(PACKAGE_ROOT, ".fullstack-forge", "skills", "fullstack-forge", "SKILL.md")
    );
    await writeFile(target, previousBytes);
    const previous = await readInstallManifest(root);
    assert.ok(previous !== undefined);
    previous.packageVersion = "0.2.2";
    previous.files[relative] = {
      hash: sha256(previousBytes),
      platform: "agents",
      owned: true
    };
    await writeFile(manifestPath, `${JSON.stringify(previous, null, 2)}\n`, "utf8");

    await assert.rejects(
      install(root, "generic", {
        global: false,
        dryRun: false,
        interruptAfter: 1
      }),
      /interruption after 1 managed write/u
    );
    assert.match(await readFile(target, "utf8"), /# Fullstack Forge/u);
    assert.match(await readFile(target, "utf8"), /fullstack-forge:managed-adapter/u);
    // The interrupted update touched an existing file, so its old manifest remains authoritative
    // until the retry reaches the final atomic manifest write. Recovery must accept that old
    // package version rather than claiming the upgrade completed before it did.
    assert.equal((await readInstallManifest(root))?.packageVersion, "0.2.2");

    const resumed = await install(root, "generic", { global: false, dryRun: false });
    assert.ok(
      resumed.some((action) => action.path === relative && action.action === "preserve-identical")
    );
    const completed = await readInstallManifest(root);
    assert.equal(completed?.packageVersion, VERSION);
    assert.equal(completed.files[relative]?.owned, true);
  });
});
