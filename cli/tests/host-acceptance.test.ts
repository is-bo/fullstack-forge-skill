/**
 * Host-acceptance tests for the canonical installation layout.
 *
 * ## What these tests are, and what they are NOT
 *
 * Every test in this file is a **host simulation**, never a live host run. No Claude Code, Codex,
 * Cursor, Gemini CLI, Windsurf, or GitHub Copilot process is launched here, and nothing in this
 * file may be reported as evidence that a live host loaded, triggered, or followed a skill. Live
 * host UI and live host loader behaviour remain `NOT_VERIFIED`.
 *
 * A "host simulation" is deliberately narrow, and that narrowness is what gives it value: the
 * resolver in this file reads **only what the named host's documented loader would read**, starting
 * from **that host's documented discovery root**, and follows the adapter's relative pointer using
 * **the same relative-path resolution an agent reading that file would perform** — from the
 * adapter's own directory, not from the install root. It fails if anything it needs is missing.
 * That proves the layout is mechanically resolvable. It does not prove any product implements the
 * loader we simulate; the documented discovery paths themselves come from `docs/PLATFORM_SUPPORT.md`
 * and could change without notice.
 *
 * Test names carry their check number so the release matrix can be read straight off the runner
 * output, and each carries `(simulated)` so no reader mistakes a filesystem pass for a live pass.
 */

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import test from "node:test";
import { PACKAGE_ROOT, VERSION, type Platform } from "../src/constants.js";
import {
  CANONICAL_ROOT_POSIX,
  extractFrontmatter,
  isAdapter,
  readAdapterMarker
} from "../src/managed-layout.js";
import { install, readInstallManifest, uninstall } from "../src/installer.js";
import { runFile, sha256 } from "../src/utils.js";
import { withTemporaryProject } from "./helpers.js";

const CLI = join(PACKAGE_ROOT, "build", "cli", "src", "index.js");
const CANONICAL_SOURCE = join(PACKAGE_ROOT, ...CANONICAL_ROOT_POSIX.split("/"));
const EXPECTED_SKILLS = 46;

/**
 * One agent host, described only by what its documented loader consumes.
 *
 * `skillsRoot` and `instructions` mirror the project-scope rows of `docs/PLATFORM_SUPPORT.md`.
 * `instructionShape` is the frontmatter or marker the host requires in its activation file; a host
 * that uses a marked section in a root instruction file has no frontmatter of its own.
 */
type HostSimulation = {
  readonly id: string;
  readonly product: string;
  readonly platform: Platform;
  readonly selector: string;
  readonly skillsRoot: readonly string[];
  readonly instructionPath: readonly string[];
  readonly instructionShape: RegExp;
  /** Codex alone reads `agents/openai.yaml` with ordinary tooling instead of following prose. */
  readonly readsVerbatimAgentMetadata: boolean;
};

const HOSTS: readonly HostSimulation[] = [
  {
    id: "claude",
    product: "Claude Code",
    platform: "claude",
    selector: "claude",
    skillsRoot: [".claude", "skills"],
    instructionPath: ["CLAUDE.md"],
    instructionShape: /<!-- fullstack-forge:automatic-activation:start -->/u,
    readsVerbatimAgentMetadata: false
  },
  {
    id: "codex",
    product: "Codex and generic Agent Skills",
    platform: "agents",
    selector: "codex",
    skillsRoot: [".agents", "skills"],
    instructionPath: ["AGENTS.md"],
    instructionShape: /<!-- fullstack-forge:automatic-activation:start -->/u,
    readsVerbatimAgentMetadata: true
  },
  {
    id: "cursor",
    product: "Cursor",
    platform: "cursor",
    selector: "cursor",
    skillsRoot: [".cursor", "skills"],
    instructionPath: [".cursor", "rules", "fullstack-forge.mdc"],
    // Cursor reads `.mdc` rule frontmatter; `alwaysApply` is what makes the rule automatic.
    instructionShape: /^---\n(?:.*\n)*?alwaysApply:\s*true\n(?:.*\n)*?---\n/u,
    readsVerbatimAgentMetadata: false
  },
  {
    id: "gemini",
    product: "Gemini CLI",
    platform: "gemini",
    selector: "gemini",
    skillsRoot: [".gemini", "skills"],
    instructionPath: ["GEMINI.md"],
    instructionShape: /<!-- fullstack-forge:automatic-activation:start -->/u,
    readsVerbatimAgentMetadata: false
  },
  {
    id: "windsurf",
    product: "Windsurf / Devin Cascade",
    platform: "windsurf",
    selector: "windsurf",
    skillsRoot: [".windsurf", "skills"],
    instructionPath: [".windsurf", "rules", "fullstack-forge.md"],
    instructionShape: /<!-- fullstack-forge:automatic-activation:start -->/u,
    readsVerbatimAgentMetadata: false
  },
  {
    id: "github",
    product: "GitHub Copilot",
    platform: "github",
    selector: "github",
    skillsRoot: [".github", "skills"],
    instructionPath: [".github", "instructions", "fullstack-forge.instructions.md"],
    // Copilot custom instructions are scoped by an `applyTo` glob in frontmatter.
    instructionShape: /^---\napplyTo:\s*"\*\*"\n---\n/u,
    readsVerbatimAgentMetadata: false
  }
] as const;

const ALL_SELECTOR = HOSTS.map((host) => host.selector).join(",");

type ResolvedSkill = {
  adapterPath: string;
  adapterText: string;
  frontmatter: string;
  pointer: string;
  canonicalPath: string;
  canonicalText: string;
};

/**
 * Resolves one skill exactly the way the named host's documented loader would.
 *
 * Reads the adapter from the host's own discovery root, parses the frontmatter the host triggers
 * on, takes the relative pointer out of the adapter body, and resolves that pointer **from the
 * adapter's own directory**. Anything missing throws, so a damaged installation can never be
 * mistaken for a working one.
 */
async function resolveThroughHost(
  root: string,
  host: HostSimulation,
  skill: string
): Promise<ResolvedSkill> {
  const discoveryRoot = join(root, ...host.skillsRoot);
  const adapterPath = join(discoveryRoot, skill, "SKILL.md");
  let adapterText: string;
  try {
    adapterText = await readFile(adapterPath, "utf8");
  } catch (error) {
    throw new Error(
      `${host.id} discovery failed: no adapter at ${adapterPath} (${(error as Error).message})`,
      { cause: error }
    );
  }
  const frontmatter = extractFrontmatter(adapterText, `${host.id}:${skill}`);

  // A host agent follows the pointer it reads in the prose body. Take the pointer from the machine
  // marker and require the prose to name the identical path, so the two can never drift apart and
  // silently send a human-read agent somewhere the machine check never validated.
  const marker = readAdapterMarker(adapterText);
  if (marker === undefined)
    throw new Error(`${host.id} adapter for ${skill} carries no managed-adapter marker`);
  if (marker.skill !== skill)
    throw new Error(`${host.id} adapter marker names ${marker.skill}, not ${skill}`);
  const pointer = marker.canonical;
  if (!adapterText.includes(`\`${pointer}\``))
    throw new Error(`${host.id} adapter for ${skill} does not state its pointer in readable prose`);

  const canonicalPath = resolve(dirname(adapterPath), ...pointer.split("/"));
  let canonicalText: string;
  try {
    canonicalText = await readFile(canonicalPath, "utf8");
  } catch (error) {
    throw new Error(
      `${host.id} could not follow the pointer for ${skill}: ${pointer} from ${dirname(adapterPath)} does not resolve to readable canonical content (${(error as Error).message})`,
      { cause: error }
    );
  }
  if (isAdapter(canonicalText))
    throw new Error(
      `${host.id} pointer for ${skill} resolves to another adapter, not the playbook`
    );
  return { adapterPath, adapterText, frontmatter, pointer, canonicalPath, canonicalText };
}

/** Enumerates the skills a host would discover: every directory under its root holding a SKILL.md. */
async function discoverSkills(root: string, host: HostSimulation): Promise<string[]> {
  const discoveryRoot = join(root, ...host.skillsRoot);
  const names: string[] = [];
  for (const entry of await readdir(discoveryRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await stat(join(discoveryRoot, entry.name, "SKILL.md"));
      names.push(entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return names.sort();
}

/** Bundled canonical bytes for one relative path, as shipped in the package. */
async function canonicalSource(relative: string): Promise<Buffer> {
  return readFile(join(CANONICAL_SOURCE, ...relative.split("/")));
}

/**
 * Bundle-relative resource paths a playbook names. The canonical prose addresses resources as
 * `fullstack-forge/<area>/...`, which resolves against the canonical skills root.
 */
function referencedResources(playbook: string): string[] {
  const pattern =
    /fullstack-forge\/(?:references|schemas|templates|profiles|checklists)\/[^\s`)"']+/gu;
  return [...new Set(playbook.match(pattern) ?? [])].filter((value) => !value.endsWith("..."));
}

/** A disposable project root whose absolute path contains spaces. */
async function withSpacedProject<T>(callback: (root: string) => Promise<T>): Promise<T> {
  const canonicalTemp = await realpath(tmpdir());
  const parent = await mkdtemp(join(canonicalTemp, "fullstack-forge-host-space-"));
  // Validated before the try, so cleanup never needs to throw out of a finally block.
  if (
    !basename(parent).startsWith("fullstack-forge-host-space-") ||
    !parent.startsWith(`${canonicalTemp}${sep}`)
  )
    throw new Error(`Refusing to use an unexpected test path: ${parent}`);
  const root = join(parent, "My Agent Projects", "forge acceptance");
  await mkdir(root, { recursive: true });
  try {
    return await callback(await realpath(root));
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

test("host acceptance 1 (simulated): every host discovers its adapters at the documented discovery path with the frontmatter it requires", async (t) => {
  await withTemporaryProject("host-discovery", async (root) => {
    await install(root, ALL_SELECTOR, { global: false, dryRun: false });
    for (const host of HOSTS) {
      await t.test(`${host.id} (${host.product}) — live host loader NOT_VERIFIED`, async () => {
        const skills = await discoverSkills(root, host);
        assert.equal(
          skills.length,
          EXPECTED_SKILLS,
          `${host.id} discovery root holds ${skills.length} skills`
        );
        assert.ok(skills.includes("fullstack-forge"));
        assert.ok(skills.includes("forge"));

        for (const skill of skills) {
          const resolved = await resolveThroughHost(root, host, skill);
          // Discovery and triggering depend on exactly these two fields.
          const name = /^name:\s*(\S+)\s*$/mu.exec(resolved.frontmatter)?.[1];
          assert.equal(
            name,
            skill,
            `${host.id}/${skill} frontmatter name must match its directory`
          );
          assert.match(
            resolved.frontmatter,
            /^description:\s*\S/mu,
            `${host.id}/${skill} needs a description to trigger on`
          );
        }

        // The host's documented automatic-activation mechanism, in the shape that host requires.
        const instructions = await readFile(join(root, ...host.instructionPath), "utf8");
        assert.match(instructions, host.instructionShape);

        if (host.readsVerbatimAgentMetadata) {
          // Codex reads this file with ordinary tooling, so a pointer would not work: it must be a
          // real copy inside the host root, and its icon path must resolve relative to itself.
          const metadata = join(root, ...host.skillsRoot, "forge", "agents", "openai.yaml");
          assert.match(await readFile(metadata, "utf8"), /short_description:/u);
          await stat(join(dirname(dirname(metadata)), "assets", "fullstack-forge-icon.png"));
        }
      });
    }
  });
});

test("host acceptance 2 (simulated): adapter frontmatter is byte-identical to the canonical frontmatter, so activation is unchanged", async (t) => {
  await withTemporaryProject("host-frontmatter", async (root) => {
    await install(root, ALL_SELECTOR, { global: false, dryRun: false });
    for (const host of HOSTS) {
      await t.test(host.id, async () => {
        for (const skill of await discoverSkills(root, host)) {
          const resolved = await resolveThroughHost(root, host, skill);
          const canonical = extractFrontmatter(
            (await canonicalSource(`${skill}/SKILL.md`)).toString("utf8"),
            `canonical:${skill}`
          );
          assert.equal(
            sha256(resolved.frontmatter),
            sha256(canonical),
            `${host.id}/${skill} adapter frontmatter drifted from canonical`
          );
        }
      });
    }
  });
});

test("host acceptance 3 (simulated): each host reads the canonical playbook through the relative pointer resolved from the adapter's own directory", async (t) => {
  await withTemporaryProject("host-pointer", async (root) => {
    await install(root, ALL_SELECTOR, { global: false, dryRun: false });
    const canonicalRoot = join(root, ...CANONICAL_ROOT_POSIX.split("/"));
    for (const host of HOSTS) {
      await t.test(host.id, async () => {
        for (const skill of await discoverSkills(root, host)) {
          const resolved = await resolveThroughHost(root, host, skill);
          assert.equal(
            resolved.canonicalPath,
            join(canonicalRoot, skill, "SKILL.md"),
            `${host.id}/${skill} pointer must land on the shared canonical copy`
          );
          // The resolved target is the real playbook, byte-for-byte, not a second copy that could
          // drift: compare against the bytes bundled in the package.
          assert.equal(
            sha256(Buffer.from(resolved.canonicalText, "utf8")),
            sha256(await canonicalSource(`${skill}/SKILL.md`))
          );
          assert.ok(resolved.canonicalText.length > resolved.adapterText.length);
        }
      });
    }
  });
});

test("host acceptance 4 (simulated): every resource a canonical playbook names resolves from the canonical root", async () => {
  await withTemporaryProject("host-references", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const host = HOSTS.find((entry) => entry.id === "claude") as HostSimulation;
    let checked = 0;
    for (const skill of await discoverSkills(root, host)) {
      const resolved = await resolveThroughHost(root, host, skill);
      // References are addressed relative to the canonical skills root, which is the directory
      // holding the skill directories — one level above the playbook itself.
      const canonicalRoot = dirname(dirname(resolved.canonicalPath));
      for (const reference of referencedResources(resolved.canonicalText)) {
        const target = resolve(canonicalRoot, ...reference.split("/"));
        assert.ok(
          target.startsWith(canonicalRoot + sep),
          `${skill} names a reference outside the canonical root: ${reference}`
        );
        await stat(target).catch((error: Error) => {
          throw new Error(
            `${skill} names ${reference}, which does not resolve under ${canonicalRoot} (${error.message})`
          );
        });
        checked += 1;
      }
    }
    assert.ok(checked > 40, `expected many resolved references, checked ${checked}`);
  });
});

test("host acceptance 5 (simulated): missing canonical content is a clear damaged installation, never a silent pass", async () => {
  await withTemporaryProject("host-damaged", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const host = HOSTS.find((entry) => entry.id === "claude") as HostSimulation;
    await resolveThroughHost(root, host, "forge-api");

    await rm(join(root, ...CANONICAL_ROOT_POSIX.split("/"), "forge-api", "SKILL.md"));

    // The host simulation must fail loudly rather than fall back to the adapter's own prose.
    await assert.rejects(
      resolveThroughHost(root, host, "forge-api"),
      /could not follow the pointer for forge-api/u
    );
    // The adapter is still discoverable, which is exactly why silent success would be dangerous.
    await stat(join(root, ...host.skillsRoot, "forge-api", "SKILL.md"));

    // `forge doctor` must report the damage with a recovery instruction, not a clean bill.
    const doctor = await runFile(
      process.execPath,
      [CLI, "doctor", "--offline", "--root", root, "--json"],
      root,
      180_000
    );
    const parsed = JSON.parse(doctor.stdout) as {
      ready: boolean;
      checks: Array<{ name: string; status: string; recovery?: string }>;
    };
    assert.equal(parsed.ready, false);
    const integrity = parsed.checks.find((check) => check.name === "installed skill integrity");
    assert.ok(integrity);
    assert.equal(integrity.status, "FAIL");
    assert.match(String(integrity.recovery), /forge update all/u);
  });
});

test("host acceptance 6 (simulated): updating one host never removes canonical content another host still needs", async () => {
  await withTemporaryProject("host-update-isolation", async (root) => {
    await install(root, "claude,cursor", { global: false, dryRun: false });
    const claude = HOSTS.find((entry) => entry.id === "claude") as HostSimulation;
    const cursor = HOSTS.find((entry) => entry.id === "cursor") as HostSimulation;
    const before = await resolveThroughHost(root, cursor, "forge-security");

    const actions = await install(root, "claude", { global: false, dryRun: false });
    assert.ok(actions.every((action) => action.action === "preserve-identical"));
    assert.ok(
      actions.every((action) => action.action !== "remove"),
      "updating one host must not retire content"
    );

    // Cursor still resolves end to end, and the canonical bytes are unchanged.
    const after = await resolveThroughHost(root, cursor, "forge-security");
    assert.equal(sha256(after.canonicalText), sha256(before.canonicalText));
    await resolveThroughHost(root, claude, "forge-security");

    const manifest = await readInstallManifest(root);
    assert.ok(manifest);
    const record = manifest.files[`${CANONICAL_ROOT_POSIX}/forge-security/SKILL.md`];
    assert.ok(record);
    assert.deepEqual(record.platforms, ["claude", "cursor"]);
  });
});

test("host acceptance 7 (simulated): uninstalling one host retains the canonical content the remaining hosts need", async () => {
  await withTemporaryProject("host-uninstall-shared", async (root) => {
    await install(root, "claude,cursor,gemini", { global: false, dryRun: false });
    const cursor = HOSTS.find((entry) => entry.id === "cursor") as HostSimulation;
    const gemini = HOSTS.find((entry) => entry.id === "gemini") as HostSimulation;

    await uninstall(root, "claude", { global: false, dryRun: false });

    // Claude's own adapters and instructions are gone.
    await assert.rejects(stat(join(root, ".claude", "skills", "forge", "SKILL.md")), {
      code: "ENOENT"
    });
    await assert.rejects(stat(join(root, "CLAUDE.md")), { code: "ENOENT" });

    // Every remaining host still resolves every skill through the shared canonical copy.
    for (const host of [cursor, gemini]) {
      const skills = await discoverSkills(root, host);
      assert.equal(skills.length, EXPECTED_SKILLS);
      for (const skill of skills) await resolveThroughHost(root, host, skill);
    }

    const manifest = await readInstallManifest(root);
    assert.ok(manifest);
    const record = manifest.files[`${CANONICAL_ROOT_POSIX}/forge-api/SKILL.md`];
    assert.ok(record, "shared canonical content must survive a partial uninstall");
    assert.deepEqual(record.platforms, ["cursor", "gemini"]);
  });
});

test("host acceptance 8 (simulated): the last uninstall removes unchanged canonical content", async () => {
  await withTemporaryProject("host-uninstall-last", async (root) => {
    await install(root, "claude,cursor", { global: false, dryRun: false });
    await uninstall(root, "claude", { global: false, dryRun: false });
    await stat(join(root, ...CANONICAL_ROOT_POSIX.split("/"), "forge-api", "SKILL.md"));

    const actions = await uninstall(root, "cursor", { global: false, dryRun: false });

    assert.ok(
      actions.some(
        (action) =>
          action.action === "remove" && action.path === `${CANONICAL_ROOT_POSIX}/forge-api/SKILL.md`
      )
    );
    await assert.rejects(stat(join(root, ".fullstack-forge", "skills")), { code: "ENOENT" });
    await assert.rejects(stat(join(root, ".fullstack-forge", "install-manifest.json")), {
      code: "ENOENT"
    });
  });
});

test("host acceptance 9 (simulated): modified canonical content is preserved on uninstall", async () => {
  await withTemporaryProject("host-modified-canonical", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const target = join(root, ...CANONICAL_ROOT_POSIX.split("/"), "forge-api", "SKILL.md");
    const edited = `${await readFile(target, "utf8")}\n<!-- local project addendum -->\n`;
    await writeFile(target, edited, "utf8");

    const actions = await uninstall(root, "claude", { global: false, dryRun: false });

    assert.ok(
      actions.some(
        (action) =>
          action.action === "preserve-modified" &&
          action.path === `${CANONICAL_ROOT_POSIX}/forge-api/SKILL.md`
      )
    );
    assert.equal(await readFile(target, "utf8"), edited);
    // Untouched canonical content is still removed, so preservation is targeted, not a blanket skip.
    await assert.rejects(
      stat(join(root, ...CANONICAL_ROOT_POSIX.split("/"), "forge-security", "SKILL.md")),
      { code: "ENOENT" }
    );
  });
});

test("host acceptance 10 (simulated): modified host adapters are preserved on uninstall", async () => {
  await withTemporaryProject("host-modified-adapter", async (root) => {
    await install(root, "claude", { global: false, dryRun: false });
    const adapter = join(root, ".claude", "skills", "forge-api", "SKILL.md");
    const edited = `${await readFile(adapter, "utf8")}\nLocal note kept by the user.\n`;
    await writeFile(adapter, edited, "utf8");

    const actions = await uninstall(root, "claude", { global: false, dryRun: false });

    assert.ok(
      actions.some(
        (action) =>
          action.action === "preserve-modified" &&
          action.path === ".claude/skills/forge-api/SKILL.md"
      )
    );
    assert.equal(await readFile(adapter, "utf8"), edited);
    // A modified adapter must also block the re-install that would silently overwrite it.
    await assert.rejects(
      install(root, "claude", { global: false, dryRun: false }),
      /Refusing to overwrite an unowned file|modified owned file/u
    );
  });
});

/**
 * Writes the previous full-copy layout: a complete playbook in each host root plus the reference
 * files that layout also duplicated, recorded by a schema-1 manifest with no `kind` field. That is
 * exactly what a pre-canonical release left on disk.
 *
 * Returns the legacy paths that the canonical layout no longer writes, which are the paths
 * migration has to retire. `<host>/<skill>/SKILL.md` is deliberately not among them: the adapter
 * occupies that same path, so it is an update, not a retirement.
 */
async function seedLegacyLayout(
  root: string,
  hosts: ReadonlyArray<readonly [string, string]>
): Promise<{ retirablePaths: string[] }> {
  const legacyFiles: Record<string, { hash: string; platform: string; owned: boolean }> = {};
  const legacySkills = ["fullstack-forge", "forge", "forge-api", "forge-security"];
  const retirablePaths: string[] = [];
  for (const [hostRoot, platform] of hosts) {
    for (const skill of legacySkills) {
      const bytes = await canonicalSource(`${skill}/SKILL.md`);
      const relative = `${hostRoot}/${skill}/SKILL.md`;
      const target = join(root, ...relative.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      legacyFiles[relative] = { hash: sha256(bytes), platform, owned: true };
    }
    // The old layout also duplicated shared references into every host root. Nothing in the
    // canonical layout writes these paths, so migration must retire them.
    const shared = `${hostRoot}/fullstack-forge/references/shared/module-contract.md`;
    const sharedBytes = await canonicalSource(
      "fullstack-forge/references/shared/module-contract.md"
    );
    const sharedTarget = join(root, ...shared.split("/"));
    await mkdir(dirname(sharedTarget), { recursive: true });
    await writeFile(sharedTarget, sharedBytes);
    legacyFiles[shared] = { hash: sha256(sharedBytes), platform, owned: true };
    retirablePaths.push(shared);
  }

  await mkdir(join(root, ".fullstack-forge"), { recursive: true });
  await writeFile(
    join(root, ".fullstack-forge", "install-manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        packageVersion: "0.0.1",
        root,
        installedAt: new Date().toISOString(),
        agent_first: true,
        automatic_activation: false,
        files: legacyFiles
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return { retirablePaths };
}

test("host acceptance 11a (simulated): upgrading from the legacy full-copy layout migrates every host and retires only duplicated content", async () => {
  await withTemporaryProject("host-legacy-upgrade", async (root) => {
    const { retirablePaths } = await seedLegacyLayout(root, [
      [".claude/skills", "claude"],
      [".cursor/skills", "cursor"]
    ]);

    const actions = await install(root, "claude,cursor", { global: false, dryRun: false });

    // Duplicated reference copies are retired; the canonical tree now holds the single copy.
    for (const retired of retirablePaths) {
      assert.ok(
        actions.some(
          (action) =>
            action.kind === "retired" && action.action === "remove" && action.path === retired
        ),
        `${retired} should have been retired`
      );
      await assert.rejects(stat(join(root, ...retired.split("/"))), { code: "ENOENT" });
    }
    // The legacy playbook path is reused by the adapter, so it is updated in place, never orphaned.
    assert.ok(
      actions.some(
        (action) => action.action === "update" && action.path === ".claude/skills/forge-api/SKILL.md"
      )
    );

    const manifest = await readInstallManifest(root);
    assert.ok(manifest);
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.packageVersion, VERSION);

    // Both hosts resolve the full skill set through the canonical root after migration.
    for (const host of HOSTS.filter((entry) => entry.id === "claude" || entry.id === "cursor")) {
      const skills = await discoverSkills(root, host);
      assert.equal(skills.length, EXPECTED_SKILLS);
      for (const skill of skills) await resolveThroughHost(root, host, skill);
    }
  });
});

test("host acceptance 11b (simulated): a legacy playbook the user edited blocks the upgrade instead of being overwritten", async () => {
  await withTemporaryProject("host-legacy-modified", async (root) => {
    await seedLegacyLayout(root, [[".cursor/skills", "cursor"]]);
    // The adapter would land on this exact path, so the user's edit is directly at risk.
    const userEdited = ".cursor/skills/forge-api/SKILL.md";
    const userBytes = "user rewrote this playbook\n";
    await writeFile(join(root, ...userEdited.split("/")), userBytes, "utf8");

    await assert.rejects(
      install(root, "cursor", { global: false, dryRun: false }),
      /Refusing to overwrite a modified owned file: \.cursor\/skills\/forge-api\/SKILL\.md/u
    );

    // The refusal happens during preflight, so the user's bytes are untouched and no legacy file
    // was retired: an aborted upgrade leaves a working previous installation, not a half-migrated one.
    assert.equal(await readFile(join(root, ...userEdited.split("/")), "utf8"), userBytes);
    await stat(
      join(root, ".cursor", "skills", "fullstack-forge", "references", "shared", "module-contract.md")
    );

    // Once the user reverts their edit the upgrade completes and the host resolves.
    await writeFile(
      join(root, ...userEdited.split("/")),
      await canonicalSource("forge-api/SKILL.md")
    );
    await install(root, "cursor", { global: false, dryRun: false });
    const cursor = HOSTS.find((entry) => entry.id === "cursor") as HostSimulation;
    for (const skill of await discoverSkills(root, cursor))
      await resolveThroughHost(root, cursor, skill);
  });
});

test("host acceptance 12 (simulated): an interrupted installation resumes to a fully resolvable layout", async () => {
  await withTemporaryProject("host-interrupted", async (root) => {
    await assert.rejects(
      install(root, "claude,cursor", { global: false, dryRun: false, interruptAfter: 25 }),
      /interruption after 25 managed write/u
    );
    const partial = await readInstallManifest(root);
    assert.ok(partial !== undefined);
    assert.ok(Object.values(partial.files).every((record) => record.owned));

    const resumed = await install(root, "claude,cursor", { global: false, dryRun: false });
    assert.ok(resumed.some((action) => action.action === "preserve-identical"));
    assert.ok(resumed.some((action) => action.action === "create"));

    for (const host of HOSTS.filter((entry) => entry.id === "claude" || entry.id === "cursor")) {
      const skills = await discoverSkills(root, host);
      assert.equal(skills.length, EXPECTED_SKILLS);
      for (const skill of skills) await resolveThroughHost(root, host, skill);
    }
    const completed = await readInstallManifest(root);
    assert.ok(completed);
    assert.ok(Object.values(completed.files).every((record) => record.owned));
  });
});

test("host acceptance 13 (simulated): an installation root whose path contains spaces resolves on every host", async () => {
  await withSpacedProject(async (root) => {
    assert.ok(root.includes(" "), `test root must contain a space: ${root}`);
    await install(root, ALL_SELECTOR, { global: false, dryRun: false });
    for (const host of HOSTS) {
      const skills = await discoverSkills(root, host);
      assert.equal(skills.length, EXPECTED_SKILLS);
      // Pointers are relative and space-free by construction; the absolute path they resolve
      // against is not. Resolve the whole set so a quoting or splitting bug cannot hide.
      for (const skill of skills) {
        const resolved = await resolveThroughHost(root, host, skill);
        assert.ok(!resolved.pointer.includes(" "));
        assert.ok(resolved.canonicalPath.includes(" "));
      }
    }
    const actions = await uninstall(root, ALL_SELECTOR, { global: false, dryRun: false });
    assert.ok(actions.every((action) => action.action === "remove"));
  });
});

test("host acceptance 14 (simulated): symlink and reparse-point protection covers host roots and the canonical root", async (t) => {
  await withTemporaryProject("host-symlink", async (root) => {
    const outside = join(root, "outside");
    await mkdir(outside);
    const linkType = process.platform === "win32" ? "junction" : "dir";

    // A redirected canonical root is the highest-value target: it is shared by every host.
    try {
      await symlink(outside, join(root, ".fullstack-forge"), linkType);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        t.skip("Creating a test reparse point requires OS privilege");
        return;
      }
      throw error;
    }
    await assert.rejects(
      install(root, "claude", { global: false, dryRun: false }),
      /symlinked install destination/u
    );
    await rm(join(root, ".fullstack-forge"), { recursive: true, force: true });

    // A redirected host discovery root must be refused just as firmly.
    await symlink(outside, join(root, ".claude"), linkType);
    await assert.rejects(
      install(root, "claude", { global: false, dryRun: false }),
      /symlinked install destination/u
    );
    // Nothing was written anywhere: a refused install leaves no manifest and no canonical tree.
    assert.equal(await readInstallManifest(root), undefined);
    await assert.rejects(stat(join(root, ".fullstack-forge", "skills")), { code: "ENOENT" });
  });
});

test("host acceptance 15: the packed npm tarball carries the canonical tree every host adapter points at", async () => {
  // Reads the file list npm would publish, not the working tree. `npm run smoke:install`,
  // `npm run smoke:upgrade`, and `npm run offline:install` additionally pack the tarball and
  // install from it; this test keeps the packaging contract enforced by the unit suite too.
  const packed = await runFile(
    process.execPath,
    [await resolveNpmCli(), "pack", "--dry-run", "--json", "--ignore-scripts"],
    PACKAGE_ROOT,
    10 * 60_000
  );
  assert.equal(packed.exitCode, 0, packed.stderr);
  const entries = (JSON.parse(packed.stdout) as Array<{ files?: Array<{ path: string }> }>)[0]
    ?.files;
  assert.ok(Array.isArray(entries), "npm pack did not report a file list");
  const paths = new Set(entries.map((entry) => entry.path.split("\\").join("/")));

  // Every skill a host would discover must have its canonical target inside the same tarball.
  const skills = (await readdir(CANONICAL_SOURCE, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.equal(skills.length, EXPECTED_SKILLS);
  for (const skill of skills)
    assert.ok(
      paths.has(`${CANONICAL_ROOT_POSIX}/${skill}/SKILL.md`),
      `packed tarball is missing canonical content for ${skill}`
    );
  for (const hostRoot of HOSTS.map((host) => host.skillsRoot.join("/")))
    assert.ok(
      paths.has(`${hostRoot}/fullstack-forge/SKILL.md`),
      `packed tarball is missing the ${hostRoot} adapter`
    );
  // Installed-project state must never be published inside the package.
  assert.ok(!paths.has(".fullstack-forge/install-manifest.json"));
});

/** Locates the npm CLI without shelling out through a shell. Mirrors the installation scripts. */
async function resolveNpmCli(): Promise<string> {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  for (const value of candidates) {
    const candidate = resolve(value);
    if (basename(candidate).toLowerCase() !== "npm-cli.js") continue;
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // Try the next installation layout.
    }
  }
  throw new Error("Could not locate an allowlisted npm-cli.js entry point");
}
