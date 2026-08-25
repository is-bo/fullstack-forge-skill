import { lstat, mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { projectRoot } from "./project.mjs";

const { dryRun, packageInput } = parseArguments(process.argv.slice(2));
const expectedVersion = JSON.parse(
  await readFile(join(projectRoot, "package.json"), "utf8")
).version;
if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dry_run: true,
        checks: [
          "npm pack",
          "optional exact dist npm package input",
          "local package install with pinned runtime dependencies",
          "CLI version",
          "installed list, validate, doctor, and composition commands",
          "source-checkout-only tool boundary",
          "init/update/uninstall ownership smoke",
          "Antigravity project and global destinations",
          "Gemini project destination",
          "no symlinks or reparse-point links"
        ]
      },
      null,
      2
    )
  );
  process.exit(0);
}

const prefix = join(tmpdir(), "fullstack-forge-smoke-");
const temporary = await mkdtemp(prefix);
validateTemporary(temporary);
try {
  const packageRoot = join(temporary, "package");
  const consumerRoot = join(temporary, "consumer");
  await mkdir(packageRoot);
  await mkdir(consumerRoot);
  const npmCli = await resolveNpmCli();
  let archive;
  let filename;
  if (packageInput === undefined) {
    const pack = await run(
      process.execPath,
      [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", packageRoot],
      projectRoot,
      10 * 60_000
    );
    if (pack.code !== 0) throw new Error(`npm pack failed:\n${pack.stderr}\n${pack.stdout}`);
    const parsed = JSON.parse(pack.stdout);
    filename = parsed?.[0]?.filename;
    if (typeof filename !== "string")
      throw new Error("npm pack did not report an archive filename");
    archive = join(packageRoot, filename);
  } else {
    filename = `fullstack-forge-skill-v${expectedVersion}.tgz`;
    archive = resolve(projectRoot, packageInput);
    const expectedArchive = resolve(projectRoot, "dist", filename);
    if (archive !== expectedArchive)
      throw new Error(`--package must identify the exact release artifact ${expectedArchive}`);
    const info = await lstat(archive);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error("--package must identify a regular, non-symlink file");
  }
  await stat(archive);

  await (
    await import("node:fs/promises")
  ).writeFile(
    join(consumerRoot, "package.json"),
    '{"name":"forge-smoke-consumer","private":true}\n',
    "utf8"
  );
  const install = await run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", archive],
    consumerRoot,
    10 * 60_000
  );
  if (install.code !== 0)
    throw new Error(`local package installation failed:\n${install.stderr}\n${install.stdout}`);
  const cli = join(
    consumerRoot,
    "node_modules",
    "fullstack-forge-skill",
    "build",
    "cli",
    "src",
    "index.js"
  );
  const version = await run(process.execPath, [cli, "--version"], consumerRoot);
  if (version.code !== 0 || version.stdout.trim() !== expectedVersion)
    throw new Error(
      `CLI version smoke failed: expected ${expectedVersion}, got ${version.stdout} ${version.stderr}`
    );
  const installedPackageRoot = join(consumerRoot, "node_modules", "fullstack-forge-skill");
  const list = await run(process.execPath, [cli, "list", "--json"], consumerRoot);
  const listResult = parseJsonResult(list, "installed list");
  if (
    list.code !== 0 ||
    !Array.isArray(listResult.tools) ||
    !listResult.tools.includes("check-platform-assets") ||
    !listResult.tool_availability?.source_checkout_only?.includes("check-platform-assets")
  )
    throw new Error(`installed list is incomplete:\n${list.stderr}\n${list.stdout}`);
  const validate = await run(process.execPath, [cli, "validate", "--json"], consumerRoot);
  const validateResult = parseJsonResult(validate, "installed validate");
  if (validate.code !== 0 || validateResult.valid !== true || validateResult.skills !== 46)
    throw new Error(`installed validation failed:\n${validate.stderr}\n${validate.stdout}`);
  const composition = await run(
    process.execPath,
    [cli, "security", "compose", "--root", consumerRoot, "--dry-run", "--json"],
    consumerRoot
  );
  const compositionResult = parseJsonResult(composition, "installed composition");
  if (
    composition.code !== 0 ||
    !Array.isArray(compositionResult.compositions) ||
    compositionResult.compositions.length === 0 ||
    compositionResult.compositions.some((entry) => entry.missing?.length !== 0) ||
    resolve(compositionResult.runtime_root) !== resolve(installedPackageRoot)
  )
    throw new Error(
      `packed upstream composition verification failed:\n${composition.stderr}\n${composition.stdout}`
    );
  const sourceOnly = await run(
    process.execPath,
    [cli, "tool", "check-platform-assets", "--json"],
    consumerRoot
  );
  const sourceOnlyResult = parseJsonResult(sourceOnly, "installed source-only tool");
  if (
    sourceOnly.code !== 2 ||
    sourceOnlyResult.status !== "BLOCKED" ||
    sourceOnlyResult.availability !== "source-checkout-only"
  )
    throw new Error(
      `source-checkout-only tool did not fail closed:\n${sourceOnly.stderr}\n${sourceOnly.stdout}`
    );

  const dryInit = await run(
    process.execPath,
    [cli, "init", "generic", "--root", consumerRoot, "--dry-run", "--json"],
    consumerRoot
  );
  if (dryInit.code !== 0 || !dryInit.stdout.includes('"dry_run": true'))
    throw new Error(`dry-run init failed: ${dryInit.stderr}`);
  const init = await run(
    process.execPath,
    [cli, "init", "generic", "--root", consumerRoot, "--json"],
    consumerRoot
  );
  if (init.code !== 0) throw new Error(`init failed: ${init.stderr}`);
  const skill = join(consumerRoot, ".agents", "skills", "fullstack-forge", "SKILL.md");
  const simpleSkill = join(consumerRoot, ".agents", "skills", "forge", "SKILL.md");
  const projectInstructions = join(consumerRoot, "AGENTS.md");
  // Host files are adapters; the playbook text lives once under the canonical root. Follow each
  // pointer the way an agent on that host would -- resolved from the adapter's own directory -- so
  // a broken pointer or missing managed content fails here instead of at the user's first request.
  for (const [adapterPath, expectedHeading] of [
    [skill, "# Fullstack Forge"],
    [simpleSkill, "# forge: Simple product workflow"]
  ]) {
    const playbook = await resolveAdapter(adapterPath);
    if (!playbook.includes(expectedHeading))
      throw new Error(`canonical playbook behind ${adapterPath} is invalid`);
  }
  // The packed artifact itself must carry the canonical tree; without it every adapter dangles.
  await stat(
    join(
      consumerRoot,
      "node_modules",
      "fullstack-forge-skill",
      ".fullstack-forge",
      "skills",
      "fullstack-forge",
      "SKILL.md"
    )
  );
  if (!(await readFile(projectInstructions, "utf8")).includes("automatic-activation:start"))
    throw new Error("generic install did not enable managed automatic activation");
  const installManifest = JSON.parse(
    await readFile(join(consumerRoot, ".fullstack-forge", "install-manifest.json"), "utf8")
  );
  if (installManifest.agent_first !== true || installManifest.automatic_activation !== true)
    throw new Error("install manifest does not record agent-first automatic activation");
  const genericSkillCount = await countSkills(join(consumerRoot, ".agents", "skills"));
  if (genericSkillCount !== 46)
    throw new Error(`generic install produced ${genericSkillCount} skills, expected 46`);
  await assertNoLinks(dirname(skill));

  const update = await run(
    process.execPath,
    [cli, "update", "generic", "--root", consumerRoot, "--json"],
    consumerRoot
  );
  if (update.code !== 0 || !update.stdout.includes("preserve-identical"))
    throw new Error(`idempotent update failed: ${update.stderr}`);
  const projectDoctor = await run(
    process.execPath,
    [cli, "doctor", "--offline", "--root", consumerRoot, "--json"],
    consumerRoot
  );
  const projectDoctorResult = parseJsonResult(projectDoctor, "installed project doctor");
  if (
    projectDoctor.code !== 0 ||
    projectDoctorResult.ready !== true ||
    !projectDoctorResult.checks?.some(
      (check) => check.name === "bundled generated copies" && check.status === "PASS"
    )
  )
    throw new Error(
      `installed project doctor failed:\n${projectDoctor.stderr}\n${projectDoctor.stdout}`
    );
  const uninstallDry = await run(
    process.execPath,
    [cli, "uninstall", "generic", "--root", consumerRoot, "--dry-run", "--json"],
    consumerRoot
  );
  if (uninstallDry.code !== 0 || !uninstallDry.stdout.includes('"action": "remove"'))
    throw new Error(`dry uninstall failed: ${uninstallDry.stderr}`);
  const uninstall = await run(
    process.execPath,
    [cli, "uninstall", "generic", "--root", consumerRoot, "--json"],
    consumerRoot
  );
  if (uninstall.code !== 0) throw new Error(`uninstall failed: ${uninstall.stderr}`);
  try {
    await stat(skill);
    throw new Error("uninstall left an owned skill file behind");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await stat(projectInstructions);
    throw new Error("uninstall left the owned automatic-activation instruction behind");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  for (const [selector, expected] of [
    ["antigravity", [".agents", "skills", "fullstack-forge", "SKILL.md"]],
    ["gemini", [".gemini", "skills", "fullstack-forge", "SKILL.md"]]
  ]) {
    const platformInstall = await run(
      process.execPath,
      [cli, "init", selector, "--root", consumerRoot, "--json"],
      consumerRoot
    );
    if (platformInstall.code !== 0)
      throw new Error(`${selector} project install failed: ${platformInstall.stderr}`);
    const installedSkill = join(consumerRoot, ...expected);
    await resolveAdapter(installedSkill);
    await resolveAdapter(join(dirname(dirname(installedSkill)), "forge", "SKILL.md"));
    const platformSkillCount = await countSkills(dirname(dirname(installedSkill)));
    if (platformSkillCount !== 46)
      throw new Error(`${selector} install produced ${platformSkillCount} skills, expected 46`);
    await assertNoLinks(dirname(installedSkill));
    const platformUninstall = await run(
      process.execPath,
      [cli, "uninstall", selector, "--root", consumerRoot, "--json"],
      consumerRoot
    );
    if (platformUninstall.code !== 0)
      throw new Error(`${selector} project uninstall failed: ${platformUninstall.stderr}`);
  }

  const isolatedHome = join(temporary, "home");
  await mkdir(isolatedHome);
  const globalEnvironment = {
    ...process.env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome
  };
  const antigravityGlobal = await run(
    process.execPath,
    [cli, "init", "antigravity", "--global", "--root", consumerRoot, "--json"],
    consumerRoot,
    120_000,
    globalEnvironment
  );
  if (antigravityGlobal.code !== 0)
    throw new Error(`Antigravity global install failed: ${antigravityGlobal.stderr}`);
  await stat(join(isolatedHome, ".gemini", "config", "skills", "fullstack-forge", "SKILL.md"));
  await assertNoLinks(isolatedHome);
  const globalDoctor = await run(
    process.execPath,
    [cli, "doctor", "--global", "--offline", "--root", consumerRoot, "--json"],
    consumerRoot,
    120_000,
    globalEnvironment
  );
  let globalDoctorResult;
  try {
    globalDoctorResult = JSON.parse(globalDoctor.stdout);
  } catch {
    globalDoctorResult = undefined;
  }
  if (
    globalDoctor.code !== 0 ||
    globalDoctorResult?.ready !== true ||
    !globalDoctorResult.checks?.some(
      (check) => check.name === "installed skill integrity" && check.status === "PASS"
    )
  )
    throw new Error(
      `Antigravity global doctor failed:\n${globalDoctor.stderr}\n${globalDoctor.stdout}`
    );
  const antigravityGlobalUninstall = await run(
    process.execPath,
    [cli, "uninstall", "antigravity", "--global", "--root", consumerRoot, "--json"],
    consumerRoot,
    120_000,
    globalEnvironment
  );
  if (antigravityGlobalUninstall.code !== 0)
    throw new Error(`Antigravity global uninstall failed: ${antigravityGlobalUninstall.stderr}`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        package: filename,
        version: version.stdout.trim(),
        install_records_removed: true,
        antigravity_project: ".agents/skills",
        antigravity_global: ".gemini/config/skills",
        gemini_project: ".gemini/skills",
        installed_skills: 46,
        upstream_runtime_verified: true,
        automatic_activation: true,
        symlinks: 0
      },
      null,
      2
    )
  );
} finally {
  validateTemporary(temporary);
  await rm(temporary, { recursive: true });
}

function parseArguments(args) {
  let dryRun = false;
  let packageInput;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--package" && packageInput === undefined) {
      packageInput = args[index + 1];
      if (packageInput === undefined || packageInput.startsWith("--"))
        throw new Error("--package requires one path");
      index += 1;
      continue;
    }
    throw new Error(`Unknown or repeated smoke-install argument: ${argument}`);
  }
  return { dryRun, packageInput };
}

function parseJsonResult(execution, label) {
  try {
    return JSON.parse(execution.stdout);
  } catch {
    throw new Error(`${label} did not return JSON:\n${execution.stderr}\n${execution.stdout}`);
  }
}

function validateTemporary(path) {
  const resolved = resolve(path);
  const resolvedTemp = resolve(tmpdir());
  if (
    !resolved.startsWith(`${resolvedTemp}${process.platform === "win32" ? "\\" : "/"}`) ||
    !basename(resolved).startsWith("fullstack-forge-smoke-")
  ) {
    throw new Error(`Refusing to remove unexpected temporary path: ${resolved}`);
  }
}

async function resolveNpmCli() {
  const configured = process.env.npm_execpath;
  const candidates = [
    configured,
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

async function run(executable, args, cwd, timeout = 120_000, environment = process.env) {
  const { execFile } = await import("node:child_process");
  return new Promise((resolvePromise) => {
    execFile(
      executable,
      args,
      { cwd, windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024, env: environment },
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

async function assertNoLinks(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Smoke installation created a link: ${path}`);
    if (entry.isDirectory()) await assertNoLinks(path);
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

/**
 * Reads an installed adapter and returns the canonical playbook it names.
 *
 * This is a host simulation, not a live host run: it performs the same relative resolution an agent
 * reading the adapter would perform, from the adapter's own directory. It proves the layout
 * resolves; it does not prove any product's loader behaves this way.
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
