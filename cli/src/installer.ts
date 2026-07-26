import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  PACKAGE_ROOT,
  PLATFORM_ALIASES,
  PLATFORM_CONFIG,
  PLATFORMS,
  VERSION,
  type Platform
} from "./constants.js";
import {
  PROJECT_INSTRUCTIONS,
  extractManagedSection,
  removeManagedSection,
  upsertManagedSection
} from "./automatic-activation.js";
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
  options: {
    global: boolean;
    dryRun: boolean;
    home?: string;
    /** Test-only fault injection. Production callers must omit this option. */
    interruptAfter?: number;
  }
): Promise<InstallAction[]> {
  if (
    options.interruptAfter !== undefined &&
    (!Number.isSafeInteger(options.interruptAfter) || options.interruptAfter < 0)
  )
    throw new Error("Installer interruption point must be a non-negative safe integer.");
  const root = options.global
    ? await canonicalDirectory(options.home ?? homedir())
    : await canonicalDirectory(rootInput);
  const platforms = normalizePlatformsForScope(selector, options.global);
  const previous = await readManifest(root);
  const planned: Array<{
    action: InstallAction;
    target: string;
    bytes: Buffer;
    record: InstallFile;
    previousHash?: string;
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
        target,
        bytes,
        record: { hash, platform, owned, management: "file" },
        ...(existingHash === undefined ? {} : { previousHash: existingHash })
      });
    }

    if (!options.global) {
      const instruction = PROJECT_INSTRUCTIONS[platform];
      if (instruction !== undefined) {
        const target = resolveInside(root, instruction.path.join("/"));
        await assertNoSymlinkPath(root, target);
        const manifestRelative = toPosix(relative(root, target));
        assertSafeRelative(manifestRelative);
        const oldRecord = previous.files[manifestRelative];
        if (oldRecord !== undefined && oldRecord.platform !== platform)
          throw new Error(`Ownership platform mismatch for ${manifestRelative}`);

        const currentText = await readTextIfPresent(target);
        const current = currentText ?? "";
        const currentFileHash = currentText === undefined ? undefined : sha256(current);
        if (instruction.management === "file") {
          const bytes = Buffer.from(instruction.content, "utf8");
          const hash = sha256(bytes);
          const owned = oldRecord?.owned ?? current.length === 0;
          if (oldRecord !== undefined && oldRecord.management === "section")
            throw new Error(`Ownership management mismatch for ${manifestRelative}`);
          if (
            oldRecord?.owned &&
            currentFileHash !== undefined &&
            currentFileHash !== oldRecord.hash &&
            currentFileHash !== hash
          )
            throw new Error(`Refusing to overwrite a modified owned file: ${manifestRelative}`);
          if (
            (!oldRecord || !oldRecord.owned) &&
            currentFileHash !== undefined &&
            currentFileHash !== hash
          )
            throw new Error(`Refusing to overwrite an unowned file: ${manifestRelative}`);
          planned.push({
            action: {
              action:
                currentFileHash === undefined
                  ? "create"
                  : currentFileHash === hash
                    ? "preserve-identical"
                    : "update",
              path: manifestRelative,
              platform
            },
            target,
            bytes,
            record: { hash, platform, owned, management: "file" },
            ...(currentFileHash === undefined ? {} : { previousHash: currentFileHash })
          });
        } else {
          const nextSection = extractManagedSection(instruction.content);
          if (nextSection === undefined)
            throw new Error("Bundled activation section is missing markers");
          const existingSection = extractManagedSection(current);
          const existingSectionHash =
            existingSection === undefined ? undefined : sha256(existingSection);
          const nextHash = sha256(nextSection);
          if (oldRecord !== undefined && oldRecord.management !== "section")
            throw new Error(`Ownership management mismatch for ${manifestRelative}`);
          if (
            oldRecord?.owned &&
            existingSectionHash !== undefined &&
            existingSectionHash !== oldRecord.hash &&
            existingSectionHash !== nextHash
          )
            throw new Error(`Refusing to overwrite a modified owned section: ${manifestRelative}`);
          if (
            (!oldRecord || !oldRecord.owned) &&
            existingSectionHash !== undefined &&
            existingSectionHash !== nextHash
          )
            throw new Error(`Refusing to overwrite an unowned section: ${manifestRelative}`);
          const nextContent = upsertManagedSection(current, nextSection);
          const owned = oldRecord?.owned ?? existingSection === undefined;
          planned.push({
            action: {
              action:
                existingSection === undefined
                  ? "create"
                  : existingSectionHash === nextHash
                    ? "preserve-identical"
                    : "update",
              path: manifestRelative,
              platform
            },
            target,
            bytes: Buffer.from(nextContent, "utf8"),
            record: { hash: nextHash, platform, owned, management: "section" },
            ...(currentFileHash === undefined ? {} : { previousHash: currentFileHash })
          });
        }
      }
    }
  }

  if (options.dryRun) return planned.map((item) => item.action);
  const next: InstallManifest = {
    schemaVersion: 1,
    packageVersion: VERSION,
    root,
    installedAt: utcNow(),
    agent_first: true,
    automatic_activation: !options.global,
    files: { ...previous.files }
  };

  // Claim every path that was absent during the complete preflight before creating any managed
  // file. If the process is interrupted after this atomic manifest write, a retry can safely
  // recreate missing owned files instead of mistaking partially installed files for pre-existing
  // unowned content. Existing and update targets retain their prior records until their bytes are
  // safely replaced, so either the old or new hash remains recoverable after a crash.
  const created = planned.filter((item) => item.action.action === "create");
  if (created.length > 0) {
    const prepared: InstallManifest = {
      ...next,
      files: { ...next.files }
    };
    for (const item of created) prepared.files[item.action.path] = item.record;
    await writeManifest(root, prepared);
  }
  if (options.interruptAfter === 0)
    throw new Error("Injected installer interruption after ownership preparation.");

  let processedWrites = 0;
  for (const item of planned) {
    if (item.action.action === "create" || item.action.action === "update") {
      const currentHash = await hashIfPresent(item.target);
      const finalHash = sha256(item.bytes);
      const unchangedSincePreflight =
        currentHash === finalHash || currentHash === item.previousHash;
      if (!unchangedSincePreflight)
        throw new Error(
          `Refusing to overwrite a file changed after preflight: ${item.action.path}`
        );
      if (currentHash !== finalHash) await atomicWrite(root, item.target, item.bytes);
      processedWrites += 1;
      if (options.interruptAfter !== undefined && processedWrites >= options.interruptAfter)
        throw new Error(
          `Injected installer interruption after ${processedWrites} managed write(s).`
        );
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
    if (record.management === "section") {
      const current = await readFile(target, "utf8");
      let section: string | undefined;
      try {
        section = extractManagedSection(current);
      } catch {
        section = undefined;
      }
      if (section === undefined || sha256(section) !== record.hash) {
        actions.push({
          action: "preserve-modified",
          path: rel,
          platform: record.platform as Platform
        });
        continue;
      }
      actions.push({ action: "remove", path: rel, platform: record.platform as Platform });
      if (!options.dryRun) {
        const next = removeManagedSection(current);
        if (next.length === 0) await unlink(target);
        else await atomicWrite(root, target, Buffer.from(next, "utf8"));
        delete remaining[rel];
      }
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
      await writeManifest(root, {
        ...manifest,
        files: remaining,
        installedAt: utcNow(),
        automatic_activation: Object.entries(remaining).some(([rel, record]) => {
          const instruction = PROJECT_INSTRUCTIONS[record.platform as Platform];
          return instruction !== undefined && instruction.path.join("/") === rel;
        })
      });
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
    return {
      schemaVersion: 1,
      packageVersion: VERSION,
      root,
      installedAt: utcNow(),
      agent_first: true,
      automatic_activation: false,
      files: {}
    };
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
    !isRecord(parsed.files) ||
    ("agent_first" in parsed && typeof parsed.agent_first !== "boolean") ||
    ("automatic_activation" in parsed && typeof parsed.automatic_activation !== "boolean")
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
      typeof record.owned !== "boolean" ||
      ("management" in record && record.management !== "file" && record.management !== "section")
    ) {
      throw new Error(`Invalid ownership record for ${rel}`);
    }
    files[rel] = {
      platform: record.platform,
      hash: record.hash,
      owned: record.owned,
      management: record.management === "section" ? "section" : "file"
    };
  }
  return {
    schemaVersion: 1,
    packageVersion: parsed.packageVersion,
    root,
    installedAt: parsed.installedAt,
    agent_first: parsed.agent_first === true,
    automatic_activation: parsed.automatic_activation === true,
    files
  };
}

export function hashInstalledRecord(content: Buffer, record: InstallFile): string | undefined {
  if (record.management !== "section") return sha256(content);
  try {
    const section = extractManagedSection(content.toString("utf8"));
    return section === undefined ? undefined : sha256(section);
  } catch {
    return undefined;
  }
}

async function writeManifest(root: string, manifest: InstallManifest): Promise<void> {
  const path = resolveInside(root, MANIFEST_RELATIVE);
  await atomicWrite(root, path, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
}

async function atomicWrite(root: string, target: string, bytes: Buffer): Promise<void> {
  const temporary = join(dirname(target), `.fullstack-forge-${randomUUID()}.tmp`);
  await assertNoSymlinkPath(root, target);
  await assertNoSymlinkPath(root, temporary);
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function hashIfPresent(path: string): Promise<string | undefined> {
  try {
    return sha256(await readFile(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
