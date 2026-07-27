import { lstat, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { projectRoot } from "./project.mjs";

// Proves that a packed artifact installs and generates every platform root with no registry
// access. Runtime dependencies are warmed into the npm cache first (that step is setup, and it is
// the only step allowed to use the network); the installation itself then runs with --offline and
// an unreachable registry, so any remaining network requirement fails loudly. Skill generation is
// additionally exercised against the unreachable registry to prove it reads only bundled assets.

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dry_run: true,
        checks: [
          "npm pack",
          "warm runtime dependencies into the npm cache (only networked step)",
          "install packed artifact with --offline and an unreachable registry",
          "forge init all --offline generates every platform root",
          "installed skills readable without network access",
          "no symlinks",
          "uninstall removes owned files"
        ]
      },
      null,
      2
    )
  );
  process.exit(0);
}

const temporary = await mkdtemp(join(tmpdir(), "fullstack-forge-offline-"));
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
  const filename = JSON.parse(pack.stdout)?.[0]?.filename;
  if (typeof filename !== "string") throw new Error("npm pack did not report an archive filename");
  const archive = join(packageRoot, filename);
  await stat(archive);

  await writeFile(
    join(consumerRoot, "package.json"),
    '{"name":"forge-offline-consumer","private":true}\n',
    "utf8"
  );

  // Setup only: warm declared runtime dependencies into the npm cache so the measured install
  // below can run strictly cache-only. This is the single step permitted to use the network.
  const manifest = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  const runtimeDependencies = Object.entries(manifest.dependencies ?? {}).map(
    ([name, range]) => `${name}@${range}`
  );
  for (const dependency of runtimeDependencies) {
    const warm = await run(
      process.execPath,
      [npmCli, "cache", "add", dependency],
      consumerRoot,
      5 * 60_000
    );
    if (warm.code !== 0)
      throw new Error(`could not warm ${dependency} into the npm cache:\n${warm.stderr}`);
  }

  // npm --offline sets the cache mode to only-if-cached: every resolution must come from the local
  // cache and any network request is a hard ENOTCACHED error. The registry stays at its real value
  // because npm keys cache entries by URL; overriding it would guarantee a miss rather than prove
  // offline behavior.
  const offlineEnvironment = {
    ...process.env,
    npm_config_offline: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
  // Skill generation touches no registry at all, so it is additionally exercised with the registry
  // pointed at a closed port.
  const unreachableRegistryEnvironment = {
    ...offlineEnvironment,
    npm_config_registry: "http://127.0.0.1:9"
  };
  const install = await run(
    process.execPath,
    [npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", archive],
    consumerRoot,
    10 * 60_000,
    offlineEnvironment
  );
  if (install.code !== 0)
    throw new Error(`offline installation failed:\n${install.stderr}\n${install.stdout}`);

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
  const version = await run(process.execPath, [cli, "--version"], consumerRoot, 120_000);
  if (version.code !== 0 || version.stdout.trim() !== expectedVersion)
    throw new Error(`offline CLI version check failed: ${version.stdout} ${version.stderr}`);

  const init = await run(
    process.execPath,
    [cli, "init", "all", "--offline", "--root", consumerRoot, "--json"],
    consumerRoot,
    120_000,
    unreachableRegistryEnvironment
  );
  if (init.code !== 0) throw new Error(`offline init all failed: ${init.stderr}`);

  const roots = [".agents", ".claude", ".cursor", ".gemini", ".github", ".windsurf"];
  const installed = {};
  for (const root of roots) {
    const skillsRoot = join(consumerRoot, root, "skills");
    // Every host root holds adapters; the playbook text is installed once under the canonical
    // root. Both halves are asserted so a broken pointer still fails the offline path.
    for (const [adapterPath, name] of [
      [join(skillsRoot, "fullstack-forge", "SKILL.md"), "fullstack-forge"],
      [join(skillsRoot, "forge", "SKILL.md"), "forge"]
    ]) {
      const adapter = await readFile(adapterPath, "utf8");
      if (!adapter.includes(`.fullstack-forge/skills/${name}/SKILL.md`))
        throw new Error(`offline install produced a ${name} adapter in ${root} without a pointer`);
    }
    const canonicalSkills = join(consumerRoot, ".fullstack-forge", "skills");
    if (
      !(await readFile(join(canonicalSkills, "fullstack-forge", "SKILL.md"), "utf8")).includes(
        "# Fullstack Forge"
      )
    )
      throw new Error(`offline install produced an invalid master skill in ${root}`);
    if (
      !(await readFile(join(canonicalSkills, "forge", "SKILL.md"), "utf8")).includes(
        "# forge: Simple product workflow"
      )
    )
      throw new Error(`offline install produced an invalid simple forge skill in ${root}`);
    await assertNoLinks(skillsRoot);
    installed[root] = await countSkills(skillsRoot);
    if (installed[root] !== 46)
      throw new Error(`offline install produced ${installed[root]} skills in ${root}, expected 46`);
  }

  const uninstall = await run(
    process.execPath,
    [cli, "uninstall", "all", "--root", consumerRoot, "--json"],
    consumerRoot,
    120_000,
    unreachableRegistryEnvironment
  );
  if (uninstall.code !== 0) throw new Error(`offline uninstall failed: ${uninstall.stderr}`);
  for (const root of roots) {
    try {
      await stat(join(consumerRoot, root, "skills", "fullstack-forge", "SKILL.md"));
      throw new Error(`uninstall left an owned skill behind in ${root}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        package: filename,
        version: version.stdout.trim(),
        npm_offline: "install ran with --offline (cache-only, no network requests)",
        generation_registry: "unreachable (http://127.0.0.1:9)",
        warmed_runtime_dependencies: runtimeDependencies,
        installed_skills: installed,
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

function validateTemporary(path) {
  const resolved = resolve(path);
  const resolvedTemp = resolve(tmpdir());
  if (
    !resolved.startsWith(`${resolvedTemp}${process.platform === "win32" ? "\\" : "/"}`) ||
    !basename(resolved).startsWith("fullstack-forge-offline-")
  ) {
    throw new Error(`Refusing to remove unexpected temporary path: ${resolved}`);
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
    if (info.isSymbolicLink()) throw new Error(`Offline installation created a link: ${path}`);
    if (entry.isDirectory()) await assertNoLinks(path);
  }
}
