import { homedir } from "node:os";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  PACKAGE_ROOT,
  PLATFORM_ALIASES,
  PLATFORM_CONFIG,
  PLATFORMS,
  VERSION,
  type Platform
} from "./constants.js";
import type { InstallFile, InstallManifest } from "./types.js";
import {
  assertNoSymlinkPath,
  assertSafeRelative,
  canonicalDirectory,
  isInside,
  readTextIfPresent,
  resolveInside,
  sha256,
  toPosix,
  utcNow,
  walkFiles
} from "./utils.js";

const MANIFEST_RELATIVE = ".fullstack-forge/install-manifest.json";

export type InstallAction = {
  action: "create" | "update" | "preserve-identical" | "remove" | "preserve-modified";
  path: string;
  platform: Platform;
};

export function normalizePlatforms(selector: string): Platform[] {
  return normalizePlatformsForScope(selector, false);
}

function normalizePlatformsForScope(selector: string, global: boolean): Platform[] {
  const normalized = selector.toLowerCase();
  if (normalized === "all")
    return global ? [...PLATFORMS] : PLATFORMS.filter((platform) => platform !== "antigravity");
  const selectors: Record<string, Platform> = {
    agents: "agents",
    ...PLATFORM_ALIASES,
    antigravity: global ? "antigravity" : "agents",
    claude: "claude",
    cursor: "cursor",
    gemini: "gemini",
    github: "github",
    copilot: "github",
    windsurf: "windsurf"
  };
  const platform = selectors[normalized];
  if (platform === undefined) {
    throw new Error(
      `Unknown platform '${selector}'. Expected claude, codex, antigravity, gemini, cursor, windsurf, github, generic, agents, or all.`
    );
  }
  return [platform];
}

export async function install(
  rootInput: string,
  selector: string,
  options: { global: boolean; dryRun: boolean; home?: string }
): Promise<InstallAction[]> {
  const root = options.global
    ? await canonicalDirectory(options.home ?? homedir())
    : await canonicalDirectory(rootInput);
  const platforms = normalizePlatformsForScope(selector, options.global);
  const previous = await readManifest(root);
  const planned: Array<{
    action: InstallAction;
    source: string;
    target: string;
    bytes: Buffer;
    record: InstallFile;
  }> = [];

  for (const platform of platforms) {
    const config = PLATFORM_CONFIG[platform];
    const sourceRoot = join(PACKAGE_ROOT, ...config.sourcePath);
    const targetParts = options.global ? config.globalPath : config.projectPath;
    const targetRoot = resolve(root, ...targetParts);
    if (!isInside(root, targetRoot))
      throw new Error(`Platform destination escapes install root: ${targetRoot}`);
    await assertNoSymlinkPath(root, targetRoot);
    const sourceFiles = (
      await walkFiles(sourceRoot, {
        maxFiles: 5_000,
        maxTotalBytes: 256 * 1024 * 1024,
        maxDepth: 64
      })
    ).filter((path) => !path.endsWith(".fullstack-forge-generated.json"));
    if (sourceFiles.length === 0)
      throw new Error(`Bundled platform assets are missing for ${platform}`);

    for (const source of sourceFiles) {
      const sourceRelative = toPosix(relative(sourceRoot, source));
      assertSafeRelative(sourceRelative);
      const target = resolveInside(targetRoot, sourceRelative);
      await assertNoSymlinkPath(root, target);
      const manifestRelative = toPosix(relative(root, target));
      assertSafeRelative(manifestRelative);
      const bytes = await readFile(source);
      const hash = sha256(bytes);
      const oldRecord = previous.files[manifestRelative];
      let existingHash: string | undefined;
      try {
        existingHash = sha256(await readFile(target));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      if (oldRecord !== undefined) {
        if (oldRecord.platform !== platform)
          throw new Error(`Ownership platform mismatch for ${manifestRelative}`);
        if (
          oldRecord.owned &&
          existingHash !== undefined &&
          existingHash !== oldRecord.hash &&
          existingHash !== hash
        ) {
          throw new Error(`Refusing to overwrite a modified owned file: ${manifestRelative}`);
        }
        if (!oldRecord.owned && existingHash !== hash) {
          throw new Error(`Refusing to update a pre-existing unowned file: ${manifestRelative}`);
        }
      } else if (existingHash !== undefined && existingHash !== hash) {
        throw new Error(`Refusing to overwrite an unowned file: ${manifestRelative}`);
      }

      const owned = oldRecord?.owned ?? existingHash === undefined;
      const action: InstallAction["action"] =
        existingHash === undefined
          ? "create"
          : existingHash === hash
            ? "preserve-identical"
            : "update";
      planned.push({
        action: { action, path: manifestRelative, platform },
        source,
        target,
        bytes,
        record: { hash, platform, owned }
      });
    }
  }

  if (options.dryRun) return planned.map((item) => item.action);
  const next: InstallManifest = {
    schemaVersion: 1,
    packageVersion: VERSION,
    root,
    installedAt: utcNow(),
    files: { ...previous.files }
  };
  for (const item of planned) {
    if (item.action.action === "create" || item.action.action === "update") {
      await mkdir(dirname(item.target), { recursive: true });
      await writeFile(item.target, item.bytes);
    }
    next.files[item.action.path] = item.record;
  }
  await writeManifest(root, next);
  return planned.map((item) => item.action);
}

export async function uninstall(
  rootInput: string,
  selector: string,
  options: { global: boolean; dryRun: boolean; home?: string }
): Promise<InstallAction[]> {
  const root = options.global
    ? await canonicalDirectory(options.home ?? homedir())
    : await canonicalDirectory(rootInput);
  const selected = new Set(normalizePlatformsForScope(selector, options.global));
  const manifest = await readManifest(root, true);
  const actions: InstallAction[] = [];
  const remaining = { ...manifest.files };
  for (const [rel, record] of Object.entries(manifest.files).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (!selected.has(record.platform as Platform)) continue;
    assertSafeRelative(rel);
    const target = resolveInside(root, rel);
    await assertNoSymlinkPath(root, target);
    let currentHash: string | undefined;
    try {
      currentHash = sha256(await readFile(target));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!record.owned || currentHash === undefined) {
      delete remaining[rel];
      continue;
    }
    if (currentHash !== record.hash) {
      actions.push({
        action: "preserve-modified",
        path: rel,
        platform: record.platform as Platform
      });
      continue;
    }
    actions.push({ action: "remove", path: rel, platform: record.platform as Platform });
    if (!options.dryRun) {
      await unlink(target);
      delete remaining[rel];
    }
  }

  if (!options.dryRun) {
    if (Object.keys(remaining).length === 0) {
      try {
        await unlink(resolveInside(root, MANIFEST_RELATIVE));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    } else {
      await writeManifest(root, { ...manifest, files: remaining, installedAt: utcNow() });
    }
  }
  return actions;
}

export async function readInstallManifest(rootInput: string): Promise<InstallManifest | undefined> {
  const root = await canonicalDirectory(rootInput);
  try {
    return await readManifest(root, true);
  } catch (error) {
    if ((error as Error).message.includes("No Fullstack Forge ownership manifest"))
      return undefined;
    throw error;
  }
}

async function readManifest(root: string, required = false): Promise<InstallManifest> {
  const path = resolveInside(root, MANIFEST_RELATIVE);
  const text = await readTextIfPresent(path);
  if (text === undefined) {
    if (required) throw new Error(`No Fullstack Forge ownership manifest at ${path}`);
    return { schemaVersion: 1, packageVersion: VERSION, root, installedAt: utcNow(), files: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Invalid Fullstack Forge ownership manifest at ${path}`);
  }
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    parsed.root !== root ||
    typeof parsed.packageVersion !== "string" ||
    typeof parsed.installedAt !== "string" ||
    !isRecord(parsed.files)
  ) {
    throw new Error(`Unsafe or unsupported ownership manifest at ${path}`);
  }
  const files: Record<string, InstallFile> = {};
  for (const [rel, record] of Object.entries(parsed.files)) {
    assertSafeRelative(rel);
    if (
      !isRecord(record) ||
      typeof record.platform !== "string" ||
      !PLATFORMS.includes(record.platform as Platform) ||
      typeof record.hash !== "string" ||
      !/^[a-f0-9]{64}$/u.test(record.hash) ||
      typeof record.owned !== "boolean"
    ) {
      throw new Error(`Invalid ownership record for ${rel}`);
    }
    files[rel] = { platform: record.platform, hash: record.hash, owned: record.owned };
  }
  return {
    schemaVersion: 1,
    packageVersion: parsed.packageVersion,
    root,
    installedAt: parsed.installedAt,
    files
  };
}

async function writeManifest(root: string, manifest: InstallManifest): Promise<void> {
  const path = resolveInside(root, MANIFEST_RELATIVE);
  await assertNoSymlinkPath(root, path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
