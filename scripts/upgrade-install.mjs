import { lstat, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { projectRoot } from "./project.mjs";

const previousTag = process.argv[2] ?? "v0.5.0";
if (!/^v\d+\.\d+\.\d+$/u.test(previousTag))
  throw new Error(`Previous release tag must be a stable semantic version: ${previousTag}`);
const platformRoots = [".agents", ".claude", ".cursor", ".gemini", ".github", ".windsurf"];

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

  await writeFile(
    join(consumerRoot, "package.json"),
    '{"name":"forge-upgrade-consumer","private":true}\n',
    "utf8"
  );
  const previousInstall = await run(
    process.execPath,
    [
      npmCli,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `git+https://github.com/is-bo/fullstack-forge-skill.git#${previousTag}`
    ],
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
  if (previousVersion.code !== 0 || `v${previousVersion.stdout.trim()}` !== previousTag)
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

  const expectedVersion = JSON.parse(
    await readFile(join(projectRoot, "package.json"), "utf8")
  ).version;
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        previous_tag: previousTag,
        previous_version: previousVersion.stdout.trim(),
        candidate_version: candidateVersion.stdout.trim(),
        codex_update: true,
        installed_skills_per_root: 46,
        forge_metadata_added: true,
        doctor_ready: true,
        symlinks: 0,
        uninstall_clean: true
      },
      null,
      2
    )
  );
} finally {
  validateTemporary(temporary);
  await rm(temporary, { recursive: true });
}

async function assertInstalledRoots(root, expectRouterMetadata) {
  for (const platformRoot of platformRoots) {
    const skillsRoot = join(root, platformRoot, "skills");
    if ((await countSkills(skillsRoot)) !== 46)
      throw new Error(`${platformRoot} does not contain exactly 46 skills`);
    if (expectRouterMetadata) {
      const metadata = await readFile(join(skillsRoot, "forge", "agents", "openai.yaml"), "utf8");
      if (!metadata.includes('short_description: "Build · Audit · Fix · Verify · Ship · Status"'))
        throw new Error(`${platformRoot} did not receive the v0.5.1 Forge picker metadata`);
    }
    await assertNoLinks(skillsRoot);
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
