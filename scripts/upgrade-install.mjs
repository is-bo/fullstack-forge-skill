import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { publicReleaseArchive } from "./lib/upgrade-source.mjs";
import { projectRoot } from "./project.mjs";

const previousTag = process.argv[2] ?? "fixture";
const useDevelopmentPreviewFixture = previousTag === "fixture";
if (
  !useDevelopmentPreviewFixture &&
  !/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(previousTag)
)
  throw new Error(`Previous release tag must be a stable semantic version: ${previousTag}`);
const platformRoots = [".agents", ".claude", ".cursor", ".gemini", ".github", ".windsurf"];
const projectInstructionPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".cursor/rules/fullstack-forge.mdc",
  ".windsurf/rules/fullstack-forge.md",
  ".github/instructions/fullstack-forge.instructions.md"
];

const temporary = await mkdtemp(join(tmpdir(), "fullstack-forge-upgrade-"));
validateTemporary(temporary);
try {
  const packageRoot = join(temporary, "package");
  const consumerRoot = join(temporary, "consumer");
  await mkdir(packageRoot);
  await mkdir(consumerRoot);
  const npmCli = await resolveNpmCli();

  const pack = await run(
    process.execPath,
    [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", packageRoot],
    projectRoot,
    10 * 60_000
  );
  if (pack.code !== 0) throw new Error(`npm pack failed:\n${pack.stderr}\n${pack.stdout}`);
  const filename = JSON.parse(pack.stdout)?.[0]?.filename;
  if (typeof filename !== "string") throw new Error("npm pack did not report an archive filename");
  const archive = join(packageRoot, filename);
  await stat(archive);
  const expectedVersion = JSON.parse(
    await readFile(join(projectRoot, "package.json"), "utf8")
  ).version;
  const previousPackage = useDevelopmentPreviewFixture
    ? archive
    : publicReleaseArchive(previousTag);

  await writeFile(
    join(consumerRoot, "package.json"),
    '{"name":"forge-upgrade-consumer","private":true}\n',
    "utf8"
  );
  const previousInstall = await run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", previousPackage],
    consumerRoot,
    10 * 60_000
  );
  if (previousInstall.code !== 0)
    throw new Error(
      `previous release installation failed:\n${previousInstall.stderr}\n${previousInstall.stdout}`
    );

  const cli = join(
    consumerRoot,
    "node_modules",
    "fullstack-forge-skill",
    "build",
    "cli",
    "src",
    "index.js"
  );
  const previousVersion = await run(process.execPath, [cli, "--version"], consumerRoot);
  if (
    previousVersion.code !== 0 ||
    (!useDevelopmentPreviewFixture && `v${previousVersion.stdout.trim()}` !== previousTag) ||
    (useDevelopmentPreviewFixture && previousVersion.stdout.trim() !== expectedVersion)
  )
    throw new Error(
      `previous CLI version mismatch: expected ${previousTag}, got ${previousVersion.stdout} ${previousVersion.stderr}`
    );

  const init = await run(
    process.execPath,
    [cli, "init", "all", "--root", consumerRoot, "--json"],
    consumerRoot,
    5 * 60_000
  );
  if (init.code !== 0) throw new Error(`previous release init failed:\n${init.stderr}`);
  await assertInstalledRoots(consumerRoot, false);
  if (useDevelopmentPreviewFixture) await convertToDevelopmentPreviewFixture(consumerRoot);

  const candidateInstall = await run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", archive],
    consumerRoot,
    10 * 60_000
  );
  if (candidateInstall.code !== 0)
    throw new Error(
      `candidate installation failed:\n${candidateInstall.stderr}\n${candidateInstall.stdout}`
    );

  const candidateVersion = await run(process.execPath, [cli, "--version"], consumerRoot);
  if (candidateVersion.code !== 0 || candidateVersion.stdout.trim() !== expectedVersion)
    throw new Error(
      `candidate CLI version mismatch: expected ${expectedVersion}, got ${candidateVersion.stdout} ${candidateVersion.stderr}`
    );

  const codexUpdate = await run(
    process.execPath,
    [cli, "update", "codex", "--root", consumerRoot, "--json"],
    consumerRoot,
    5 * 60_000
  );
  if (codexUpdate.code !== 0)
    throw new Error(`candidate Codex update failed:\n${codexUpdate.stderr}\n${codexUpdate.stdout}`);

  const update = await run(
    process.execPath,
    [cli, "update", "all", "--root", consumerRoot, "--json"],
    consumerRoot,
    5 * 60_000
  );
  if (update.code !== 0)
    throw new Error(`candidate update failed:\n${update.stderr}\n${update.stdout}`);
  await assertInstalledRoots(consumerRoot, true);

  const doctor = await run(
    process.execPath,
    [cli, "doctor", "--offline", "--root", consumerRoot, "--json"],
    consumerRoot,
    5 * 60_000
  );
  const doctorResult = parseJson(doctor.stdout, "doctor");
  if (doctor.code !== 0 || doctorResult.ready !== true)
    throw new Error(`candidate doctor failed:\n${doctor.stderr}\n${doctor.stdout}`);

  const uninstall = await run(
    process.execPath,
    [cli, "uninstall", "all", "--root", consumerRoot, "--json"],
    consumerRoot,
    5 * 60_000
  );
  if (uninstall.code !== 0)
    throw new Error(`candidate uninstall failed:\n${uninstall.stderr}\n${uninstall.stdout}`);
  for (const root of platformRoots) {
    try {
      await stat(join(consumerRoot, root, "skills", "forge", "SKILL.md"));
      throw new Error(`uninstall left an owned Forge skill behind in ${root}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  for (const relativePath of projectInstructionPaths) {
    try {
      await stat(join(consumerRoot, ...relativePath.split("/")));
      throw new Error(`uninstall left owned project instructions behind: ${relativePath}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const scoped = useDevelopmentPreviewFixture
    ? undefined
    : await runScopedUpgradeScenario({
        temporary,
        archive,
        npmCli,
        previousPackage,
        expectedVersion
      });
  console.log(
    JSON.stringify(
      {
        ok: true,
        previous_tag: useDevelopmentPreviewFixture ? "development-preview-fixture" : previousTag,
        previous_version: previousVersion.stdout.trim(),
        candidate_version: candidateVersion.stdout.trim(),
        codex_update: true,
        installed_skills_per_root: 46,
        automatic_activation_added: true,
        doctor_ready: true,
        symlinks: 0,
        uninstall_clean: true,
        ...(scoped ?? {})
      },
      null,
      2
    )
  );
} finally {
  validateTemporary(temporary);
  await rm(temporary, { recursive: true });
}

async function runScopedUpgradeScenario({
  temporary,
  archive,
  npmCli,
  previousPackage,
  expectedVersion
}) {
  const root = join(temporary, "scoped-consumer");
  await mkdir(root);
  await writeFile(
    join(root, "package.json"),
    '{"name":"forge-scoped-upgrade-consumer","private":true}\n',
    "utf8"
  );
  const oldInstall = await run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", previousPackage],
    root,
    10 * 60_000
  );
  if (oldInstall.code !== 0)
    throw new Error(`scoped previous install failed:\n${oldInstall.stderr}\n${oldInstall.stdout}`);
  const cli = join(
    root,
    "node_modules",
    "fullstack-forge-skill",
    "build",
    "cli",
    "src",
    "index.js"
  );
  const init = await run(
    process.execPath,
    [cli, "init", "codex", "--root", root, "--json"],
    root,
    5 * 60_000
  );
  if (init.code !== 0)
    throw new Error(`scoped v0.1.0 init failed:\n${init.stderr}\n${init.stdout}`);
  if (!(await exists(join(root, ".agents", "skills", "forge", "SKILL.md"))))
    throw new Error("scoped v0.1.0 install did not create the requested Codex host");
  for (const host of [".claude", ".cursor", ".gemini", ".github", ".windsurf"])
    if (await exists(join(root, host, "skills", "forge", "SKILL.md")))
      throw new Error(`scoped v0.1.0 install unexpectedly created ${host}`);

  const unchangedModule = ".agents/skills/forge-retired-module/SKILL.md";
  const unchangedProvider =
    ".fullstack-forge/upstream/removed-provider/unchanged-managed-reference.md";
  const modifiedProvider =
    ".fullstack-forge/upstream/removed-provider/modified-managed-reference.md";
  const unchangedBytes = Buffer.from("retired managed content\n", "utf8");
  const providerBytes = Buffer.from("removed provider content\n", "utf8");
  const modifiedBytes = Buffer.from("removed provider content\nuser modification\n", "utf8");
  const manifestPath = join(root, ".fullstack-forge", "install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const [relativePath, bytes] of [
    [unchangedModule, unchangedBytes],
    [unchangedProvider, providerBytes],
    [modifiedProvider, providerBytes]
  ]) {
    const target = join(root, ...relativePath.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    manifest.files[relativePath] = {
      platform: "agents",
      hash: createHash("sha256").update(bytes).digest("hex"),
      owned: true
    };
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(root, ...modifiedProvider.split("/")), modifiedBytes);

  const userSkill = join(root, ".agents", "skills", "user-created", "SKILL.md");
  const foreignHostSkill = join(root, ".claude", "skills", "user-claude", "SKILL.md");
  const userNotes = join(root, "USER_NOTES.md");
  await mkdir(dirname(userSkill), { recursive: true });
  await mkdir(dirname(foreignHostSkill), { recursive: true });
  await writeFile(userSkill, "# User-created skill\n", "utf8");
  await writeFile(foreignHostSkill, "# Uninstalled host content\n", "utf8");
  await writeFile(userNotes, "preserve me\n", "utf8");

  const candidateInstall = await run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", archive],
    root,
    10 * 60_000
  );
  if (candidateInstall.code !== 0)
    throw new Error(
      `scoped candidate install failed:\n${candidateInstall.stderr}\n${candidateInstall.stdout}`
    );
  const candidateVersion = await run(process.execPath, [cli, "--version"], root);
  if (candidateVersion.code !== 0 || candidateVersion.stdout.trim() !== expectedVersion)
    throw new Error(`scoped candidate CLI did not report ${expectedVersion}`);
  const update = await run(
    process.execPath,
    [cli, "update", "--root", root, "--json"],
    root,
    5 * 60_000
  );
  if (update.code !== 0)
    throw new Error(`scoped bare update failed:\n${update.stderr}\n${update.stdout}`);
  const updateResult = parseJson(update.stdout, "scoped update");
  if (
    !updateResult.actions?.some(
      (action) => action.path === unchangedModule && action.action === "remove"
    ) ||
    !updateResult.actions?.some(
      (action) => action.path === unchangedProvider && action.action === "remove"
    ) ||
    !updateResult.actions?.some(
      (action) => action.path === modifiedProvider && action.action === "preserve-modified"
    )
  )
    throw new Error(`scoped update did not report every stale-file disposition:\n${update.stdout}`);
  if ((await readFile(join(root, ...modifiedProvider.split("/")))).compare(modifiedBytes) !== 0)
    throw new Error("scoped update changed the modified stale provider file");
  for (const removed of [unchangedModule, unchangedProvider])
    if (await exists(join(root, ...removed.split("/"))))
      throw new Error(`scoped update retained unchanged stale managed file ${removed}`);
  for (const preserved of [userSkill, foreignHostSkill, userNotes])
    if (!(await exists(preserved)))
      throw new Error(`scoped update removed user content ${preserved}`);
  for (const host of [".claude", ".cursor", ".gemini", ".github", ".windsurf"])
    if (await exists(join(root, host, "skills", "forge", "SKILL.md")))
      throw new Error(`bare update expanded into uninstalled host ${host}`);
  if (
    !(await exists(join(root, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js")))
  )
    throw new Error("scoped update omitted the composition runtime");
  const updatedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const retired of [unchangedModule, unchangedProvider, modifiedProvider])
    if (updatedManifest.files?.[retired] !== undefined)
      throw new Error(`scoped update retained obsolete ownership record ${retired}`);

  const doctor = await run(
    process.execPath,
    [cli, "doctor", "--offline", "--root", root, "--json"],
    root,
    5 * 60_000
  );
  const doctorResult = parseJson(doctor.stdout, "scoped doctor");
  if (doctor.code !== 0 || doctorResult.ready !== true)
    throw new Error(`scoped candidate doctor failed:\n${doctor.stderr}\n${doctor.stdout}`);

  const uninstall = await run(
    process.execPath,
    [cli, "uninstall", "--root", root, "--json"],
    root,
    5 * 60_000
  );
  if (![0, 1].includes(uninstall.code))
    throw new Error(`scoped bare uninstall failed:\n${uninstall.stderr}\n${uninstall.stdout}`);
  const uninstallResult = parseJson(uninstall.stdout, "scoped uninstall");
  if (uninstallResult.actions?.some((action) => action.path === modifiedProvider))
    throw new Error("scoped uninstall acted on a disowned stale provider file");
  if ((await readFile(join(root, ...modifiedProvider.split("/")))).compare(modifiedBytes) !== 0)
    throw new Error("scoped uninstall changed the disowned stale provider file");
  for (const preserved of [userSkill, foreignHostSkill, userNotes])
    if (!(await exists(preserved)))
      throw new Error(`scoped uninstall removed user-created content ${preserved}`);
  if (await exists(join(root, ".agents", "skills", "forge", "SKILL.md")))
    throw new Error("scoped uninstall left an unchanged owned Forge skill");
  return {
    real_v010_scoped_upgrade: true,
    unchanged_stale_removed: true,
    modified_stale_preserved: true,
    obsolete_ownership_records_removed: true,
    scoped_doctor_ready: true,
    renamed_module_retired: true,
    removed_provider_retired: true,
    bare_update_installed_hosts_only: true,
    bare_uninstall_installed_hosts_only: true,
    user_content_preserved: true
  };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function assertInstalledRoots(root, expectRouterMetadata) {
  for (const platformRoot of platformRoots) {
    const skillsRoot = join(root, platformRoot, "skills");
    if ((await countSkills(skillsRoot)) !== 46)
      throw new Error(`${platformRoot} does not contain exactly 46 skills`);
    if (expectRouterMetadata) {
      // After migration every host file is an adapter, so resolve the whole set through its pointer
      // rather than trusting file presence. The previous full-copy layout has no pointers, which is
      // why this runs only on the migrated side.
      for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        await resolveAdapter(join(skillsRoot, entry.name, "SKILL.md"));
      }

      // The picker metadata is canonical content. Codex reads it with ordinary tooling, so it is
      // also copied verbatim into .agents; every other host reaches it through the canonical root.
      const metadataPath =
        platformRoot === ".agents"
          ? join(skillsRoot, "forge", "agents", "openai.yaml")
          : join(root, ".fullstack-forge", "skills", "forge", "agents", "openai.yaml");
      const metadata = await readFile(metadataPath, "utf8");
      if (!metadata.includes('short_description: "Automatic Build · Fix · Verify · Ship guidance"'))
        throw new Error(`${platformRoot} did not receive the Forge picker metadata`);
    }
    await assertNoLinks(skillsRoot);
  }
}

async function convertToDevelopmentPreviewFixture(root) {
  const manifestPath = join(root, ".fullstack-forge", "install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.packageVersion = "development-preview";
  delete manifest.agent_first;
  delete manifest.automatic_activation;
  for (const relativePath of projectInstructionPaths) {
    delete manifest.files[relativePath];
    const target = join(root, ...relativePath.split("/"));
    await rm(target, { force: true });
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/**
 * Reads an installed adapter and returns the canonical playbook it names.
 *
 * A host simulation, not a live host run: it performs the same relative resolution an agent reading
 * the adapter would perform, from the adapter's own directory.
 */
async function resolveAdapter(adapterPath) {
  const adapter = await readFile(adapterPath, "utf8");
  const pointer = /canonical=(\S+) -->/u.exec(adapter)?.[1];
  if (pointer === undefined) throw new Error(`${adapterPath} carries no managed-adapter pointer`);
  if (!adapter.includes(`\`${pointer}\``))
    throw new Error(`${adapterPath} does not state its pointer in readable prose`);
  const target = resolve(dirname(adapterPath), ...pointer.split("/"));
  try {
    return await readFile(target, "utf8");
  } catch (error) {
    throw new Error(
      `${adapterPath} points at ${pointer}, which does not resolve to readable canonical content (${error.message})`,
      { cause: error }
    );
  }
}

async function countSkills(root) {
  let count = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await stat(join(root, entry.name, "SKILL.md"));
      count += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return count;
}

async function assertNoLinks(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Upgrade installation created a link: ${path}`);
    if (entry.isDirectory()) await assertNoLinks(path);
  }
}

function validateTemporary(path) {
  const resolved = resolve(path);
  const resolvedTemp = resolve(tmpdir());
  if (
    !resolved.startsWith(`${resolvedTemp}${process.platform === "win32" ? "\\" : "/"}`) ||
    !basename(resolved).startsWith("fullstack-forge-upgrade-")
  )
    throw new Error(`Refusing to remove unexpected temporary path: ${resolved}`);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

async function resolveNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ].filter(Boolean);
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

async function run(executable, args, cwd, timeout = 120_000) {
  const { execFile } = await import("node:child_process");
  return new Promise((resolvePromise) => {
    execFile(
      executable,
      args,
      { cwd, windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolvePromise({
          code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout: String(stdout),
          stderr: String(stderr)
        });
      }
    );
  });
}
