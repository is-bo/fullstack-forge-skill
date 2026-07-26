import { lstat, mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { projectRoot } from "./project.mjs";

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dry_run: true,
        checks: [
          "npm pack",
          "local package install with pinned runtime dependencies",
          "CLI version",
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
  const pack = await run(
    process.execPath,
    [npmCli, "pack", "--json", "--pack-destination", packageRoot],
    projectRoot,
    10 * 60_000
  );
  if (pack.code !== 0) throw new Error(`npm pack failed:\n${pack.stderr}\n${pack.stdout}`);
  const parsed = JSON.parse(pack.stdout);
  const filename = parsed?.[0]?.filename;
  if (typeof filename !== "string") throw new Error("npm pack did not report an archive filename");
  const archive = join(packageRoot, filename);
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
  const expectedVersion = JSON.parse(
    await readFile(join(projectRoot, "package.json"), "utf8")
  ).version;
  const version = await run(process.execPath, [cli, "--version"], consumerRoot);
  if (version.code !== 0 || version.stdout.trim() !== expectedVersion)
    throw new Error(
      `CLI version smoke failed: expected ${expectedVersion}, got ${version.stdout} ${version.stderr}`
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
  if (!(await readFile(skill, "utf8")).includes("# Fullstack Forge"))
    throw new Error("installed master skill is invalid");
  if (!(await readFile(simpleSkill, "utf8")).includes("# forge: Simple product workflow"))
    throw new Error("installed simple forge skill is invalid");
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
    await stat(installedSkill);
    await stat(join(dirname(dirname(installedSkill)), "forge", "SKILL.md"));
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
