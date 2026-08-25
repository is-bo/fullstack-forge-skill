import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from "node:fs/promises";
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
import { legacyHashMatches } from "./legacy-install-hashes.js";
import {
  CANONICAL_ROOT_POSIX,
  CANONICAL_ROOT_SEGMENTS,
  adapterPointer,
  extractFrontmatter,
  isVerbatimHostFile,
  renderAdapter
} from "./managed-layout.js";
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
const MANIFEST_SCHEMA_VERSION = 2;

/** Bundled canonical managed content. One copy serves every installed host. */
const CANONICAL_SOURCE_ROOT = join(PACKAGE_ROOT, ...CANONICAL_ROOT_SEGMENTS);

/**
 * Managed content that is installed once alongside the canonical skills but is deliberately not
 * host-discoverable: the compiled upstream expertise and the manifests the composition engine
 * reads. These live under `.fullstack-forge/` and outside every host skills root, so no agent host
 * can find or trigger an upstream skill independently of Forge.
 */
const MANAGED_SUPPORT_ROOTS = Object.freeze([
  { source: "upstream", segments: [".fullstack-forge", "upstream"] },
  { source: "manifests", segments: [".fullstack-forge", "manifests"] },
  { source: "runtime", segments: [".fullstack-forge", "runtime"] }
]);

/**
 * Hosts whose skills root must also receive verbatim copies of the Codex agent metadata and its
 * icon. Codex reads `agents/openai.yaml` with ordinary tooling rather than with an agent that can
 * follow a prose pointer, and that file names `./assets/fullstack-forge-icon.png` relative to
 * itself. Every other host consumes only `SKILL.md` and therefore receives adapters alone.
 */
const VERBATIM_PLATFORMS = new Set<Platform>(["agents", "antigravity"]);

type ManagedPathInventory = {
  /** Exact paths installed below `.fullstack-forge/`; directory prefixes are never trusted. */
  canonicalPaths: ReadonlySet<string>;
  supportPaths: ReadonlySet<string>;
  /** Exact paths from the legacy full-copy layout, keyed by the manifest platform. */
  legacyHostPaths: ReadonlyMap<Platform, ReadonlySet<string>>;
  /** Exact paths retained in the current host adapter layout. */
  adapterPaths: ReadonlyMap<Platform, ReadonlySet<string>>;
  /** Hashes the bundled package is allowed to claim for each exact path. */
  expectedHashes: ReadonlyMap<string, ReadonlySet<string>>;
};

export type InstallAction = {
  action: "create" | "update" | "preserve-identical" | "remove" | "preserve-modified";
  path: string;
  platform: Platform;
  /**
   * `canonical` is the single shared managed copy, `adapter` is a thin host pointer or a documented
   * host verbatim file, `instructions` is a managed project-instruction file or section, and
   * `retired` is a previous-layout file removed by migration.
   */
  kind?: "canonical" | "adapter" | "instructions" | "retired";
};

type PlannedWrite = {
  action: InstallAction;
  target: string;
  bytes: Buffer;
  record: InstallFile;
  previousHash?: string;
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
  const requested = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const platforms = requested.map((value) => selectors[value]);
  if (requested.length === 0 || platforms.some((platform) => platform === undefined))
    throw new Error(
      `Unknown platform selector '${selector}'. Expected a comma-separated subset of claude, codex, antigravity, gemini, cursor, windsurf, github, generic, agents, or all.`
    );
  return [...new Set(platforms as Platform[])];
}

/** Reads the bundled canonical tree once per invocation. */
async function readCanonicalSource(): Promise<Map<string, Buffer>> {
  const files = await walkFiles(CANONICAL_SOURCE_ROOT, {
    maxFiles: 5_000,
    maxTotalBytes: 256 * 1024 * 1024,
    maxDepth: 64,
    rejectSymlinks: true
  });
  const map = new Map<string, Buffer>();
  for (const path of files) {
    const rel = toPosix(relative(CANONICAL_SOURCE_ROOT, path));
    if (rel.endsWith(".fullstack-forge-generated.json")) continue;
    assertSafeRelative(rel);
    map.set(rel, await readFile(path));
  }
  if (map.size === 0)
    throw new Error(`Bundled canonical managed content is missing at ${CANONICAL_SOURCE_ROOT}`);
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Reads one bundled managed-support tree. Missing content is a damaged package rather than an
 * optional extra: without the compiled upstream tree and the manifests, every hybrid and
 * upstream-powered module would resolve to a missing source at runtime.
 */
async function readManagedSupportSource(sourceRoot: string): Promise<Map<string, Buffer>> {
  const files = await walkFiles(sourceRoot, {
    maxFiles: 20_000,
    maxTotalBytes: 256 * 1024 * 1024,
    maxDepth: 64,
    rejectSymlinks: true
  });
  const map = new Map<string, Buffer>();
  for (const path of files) {
    const rel = toPosix(relative(sourceRoot, path));
    // Generator ownership markers describe the package workspace, not consumer-managed content.
    // Never copy or record them in an install manifest: doing so makes a later package regeneration
    // look like an unexpected consumer file and weakens the exact inventory boundary.
    if (rel.endsWith(".fullstack-forge-generated.json")) continue;
    assertSafeRelative(rel);
    // Refuse to install anything a host could discover as a skill.
    if (rel.split("/").pop() === "SKILL.md")
      throw new Error(`Refusing to install a host-discoverable upstream skill file: ${rel}`);
    map.set(rel, await readFile(path));
  }
  if (map.size === 0) throw new Error(`Bundled managed content is missing at ${sourceRoot}`);
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Builds the ownership boundary from the files that this package actually ships. Keeping this as
 * an exact set is intentional: a manifest may authorize one known file, never an arbitrary child
 * of a managed-looking directory. `canonical` and `support` accept either maps (during install)
 * or path sets (when a manifest is read on its own).
 */
function buildManagedPathInventory(input: {
  canonical: ReadonlyMap<string, Buffer>;
  support: ReadonlyMap<string, ReadonlyMap<string, Buffer>>;
}): ManagedPathInventory {
  const canonicalRelativePaths = [...input.canonical.keys()];
  const canonicalPaths = new Set<string>();
  const expectedHashes = new Map<string, Set<string>>();
  for (const rel of canonicalRelativePaths) {
    assertSafeRelative(rel);
    const path = `${CANONICAL_ROOT_POSIX}/${rel}`;
    canonicalPaths.add(path);
    addExpectedHash(expectedHashes, path, sha256(input.canonical.get(rel) as Buffer));
  }

  const supportPaths = new Set<string>();
  for (const support of MANAGED_SUPPORT_ROOTS) {
    const files = input.support.get(support.source);
    if (files === undefined)
      throw new Error(`Bundled managed content inventory is missing: ${support.source}`);
    const root = support.segments.join("/");
    for (const [rel, bytes] of files) {
      assertSafeRelative(rel);
      if (rel.split("/").pop() === "SKILL.md")
        throw new Error(`Managed support inventory contains a host-discoverable skill: ${rel}`);
      const path = `${root}/${rel}`;
      supportPaths.add(path);
      addExpectedHash(expectedHashes, path, sha256(bytes));
    }
  }

  const legacyHostPaths = new Map<Platform, Set<string>>();
  const adapterPaths = new Map<Platform, Set<string>>();
  const skillNames = skillNamesOf(input.canonical);
  for (const platform of PLATFORMS) {
    const legacy = new Set<string>();
    const adapters = new Set<string>();
    const config = PLATFORM_CONFIG[platform];
    const hostRoots = new Set([config.projectPath.join("/"), config.globalPath.join("/")]);
    for (const hostRoot of hostRoots) {
      for (const [rel, bytes] of input.canonical) {
        const legacyPath = `${hostRoot}/${rel}`;
        legacy.add(legacyPath);
        addExpectedHash(expectedHashes, legacyPath, sha256(bytes));
      }
      for (const skill of skillNames) {
        const canonical = input.canonical.get(`${skill}/SKILL.md`);
        if (canonical === undefined)
          throw new Error(`Bundled canonical skill is missing: ${skill}`);
        const adapterPath = `${hostRoot}/${skill}/SKILL.md`;
        adapters.add(adapterPath);
        // A schema-1 manifest records the full-copy bytes at this same path; accepting the
        // canonical hash permits safe migration while still rejecting arbitrary forged bytes.
        addExpectedHash(expectedHashes, adapterPath, sha256(canonical));
        const frontmatter = extractFrontmatter(canonical.toString("utf8"), `${skill}/SKILL.md`);
        const pointer = adapterPointer(hostRoot, skill);
        addExpectedHash(
          expectedHashes,
          adapterPath,
          sha256(Buffer.from(renderAdapter({ skill, pointer, frontmatter })))
        );
      }
      if (VERBATIM_PLATFORMS.has(platform)) {
        for (const [rel, bytes] of input.canonical)
          if (isVerbatimHostFile(rel)) {
            const path = `${hostRoot}/${rel}`;
            adapters.add(path);
            addExpectedHash(expectedHashes, path, sha256(bytes));
          }
      }
    }
    legacyHostPaths.set(platform, legacy);
    adapterPaths.set(platform, adapters);
  }
  for (const instruction of Object.values(PROJECT_INSTRUCTIONS)) {
    const path = instruction.path.join("/");
    if (instruction.management === "section") {
      const section = extractManagedSection(instruction.content);
      if (section !== undefined) addExpectedHash(expectedHashes, path, sha256(section));
    } else addExpectedHash(expectedHashes, path, sha256(Buffer.from(instruction.content)));
  }
  return { canonicalPaths, supportPaths, legacyHostPaths, adapterPaths, expectedHashes };
}

function addExpectedHash(
  expectedHashes: Map<string, Set<string>>,
  path: string,
  hash: string
): void {
  const values = expectedHashes.get(path) ?? new Set<string>();
  values.add(hash);
  expectedHashes.set(path, values);
}

/** Lists bundled paths without reading their bytes, for `readInstallManifest`/`uninstall`. */
let managedPathInventoryCache: ManagedPathInventory | undefined;

async function readManagedPathInventory(): Promise<ManagedPathInventory> {
  if (managedPathInventoryCache !== undefined) return managedPathInventoryCache;
  const inventory = await loadManagedPathInventory();
  managedPathInventoryCache = inventory;
  return inventory;
}

async function loadManagedPathInventory(): Promise<ManagedPathInventory> {
  const canonicalFiles = await walkFiles(CANONICAL_SOURCE_ROOT, {
    maxFiles: 5_000,
    maxTotalBytes: 256 * 1024 * 1024,
    maxDepth: 64,
    rejectSymlinks: true
  });
  const canonical = new Map<string, Buffer>();
  for (const path of canonicalFiles) {
    const rel = toPosix(relative(CANONICAL_SOURCE_ROOT, path));
    if (rel.endsWith(".fullstack-forge-generated.json")) continue;
    assertSafeRelative(rel);
    canonical.set(rel, await readFile(path));
  }
  if (canonical.size === 0)
    throw new Error(`Bundled canonical managed content is missing at ${CANONICAL_SOURCE_ROOT}`);

  const support = new Map<string, Map<string, Buffer>>();
  for (const managed of MANAGED_SUPPORT_ROOTS) {
    const sourceRoot = join(PACKAGE_ROOT, ".fullstack-forge", managed.source);
    const files = await walkFiles(sourceRoot, {
      maxFiles: 20_000,
      maxTotalBytes: 256 * 1024 * 1024,
      maxDepth: 64,
      rejectSymlinks: true
    });
    const relativePaths = new Map<string, Buffer>();
    for (const path of files) {
      const rel = toPosix(relative(sourceRoot, path));
      if (rel.endsWith(".fullstack-forge-generated.json")) continue;
      assertSafeRelative(rel);
      if (rel.split("/").pop() === "SKILL.md")
        throw new Error(`Refusing to install a host-discoverable upstream skill file: ${rel}`);
      relativePaths.set(rel, await readFile(path));
    }
    if (relativePaths.size === 0)
      throw new Error(`Bundled managed content is missing at ${sourceRoot}`);
    support.set(managed.source, relativePaths);
  }
  return buildManagedPathInventory({ canonical, support });
}

function skillNamesOf(canonical: ReadonlyMap<string, Buffer>): string[] {
  const names = new Set<string>();
  for (const rel of canonical.keys()) {
    const parts = rel.split("/");
    if (parts.length === 2 && parts[1] === "SKILL.md" && parts[0]) names.add(parts[0]);
  }
  return [...names].sort();
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
  const canonical = await readCanonicalSource();
  const supportSources = new Map<string, Map<string, Buffer>>();
  for (const support of MANAGED_SUPPORT_ROOTS) {
    const sourceRoot = join(PACKAGE_ROOT, ".fullstack-forge", support.source);
    supportSources.set(support.source, await readManagedSupportSource(sourceRoot));
  }
  const inventory = buildManagedPathInventory({ canonical, support: supportSources });
  const previous = await readManifest(root, false, inventory);
  const skills = skillNamesOf(canonical);
  const planned: PlannedWrite[] = [];
  const plannedPaths = new Set<string>();

  // 1. The single canonical managed copy, shared by every selected host.
  const canonicalRoot = resolve(root, ...CANONICAL_ROOT_SEGMENTS);
  if (!isInside(root, canonicalRoot))
    throw new Error(`Canonical destination escapes install root: ${canonicalRoot}`);
  await assertNoSymlinkPath(root, canonicalRoot);
  for (const [rel, bytes] of canonical) {
    const target = resolveInside(canonicalRoot, rel);
    await assertNoSymlinkPath(root, target);
    const manifestRelative = toPosix(relative(root, target));
    assertSafeRelative(manifestRelative);
    const write = await planFileWrite({
      root,
      manifestRelative,
      target,
      bytes,
      previous,
      platform: platforms[0] as Platform,
      kind: "canonical",
      platforms
    });
    planned.push(write);
    plannedPaths.add(manifestRelative);
  }

  // 1b. Compiled upstream expertise and composition manifests. Installed once, never duplicated
  //     per host, and never inside a host skills root.
  for (const support of MANAGED_SUPPORT_ROOTS) {
    const files = supportSources.get(support.source);
    if (files === undefined)
      throw new Error(`Bundled managed content is missing at ${support.source}`);
    const destinationRoot = resolve(root, ...support.segments);
    if (!isInside(root, destinationRoot))
      throw new Error(`Managed destination escapes install root: ${destinationRoot}`);
    await assertNoSymlinkPath(root, destinationRoot);
    for (const [rel, bytes] of files) {
      const target = resolveInside(destinationRoot, rel);
      await assertNoSymlinkPath(root, target);
      const manifestRelative = toPosix(relative(root, target));
      assertSafeRelative(manifestRelative);
      const write = await planFileWrite({
        root,
        manifestRelative,
        target,
        bytes,
        previous,
        platform: platforms[0] as Platform,
        kind: "canonical",
        platforms
      });
      planned.push(write);
      plannedPaths.add(manifestRelative);
    }
  }

  // 2. Thin per-host adapters plus the documented verbatim exception.
  for (const platform of platforms) {
    const config = PLATFORM_CONFIG[platform];
    const targetParts = options.global ? config.globalPath : config.projectPath;
    const hostRootPosix = targetParts.join("/");
    const targetRoot = resolve(root, ...targetParts);
    if (!isInside(root, targetRoot))
      throw new Error(`Platform destination escapes install root: ${targetRoot}`);
    await assertNoSymlinkPath(root, targetRoot);

    const hostFiles = new Map<string, Buffer>();
    for (const skill of skills) {
      const source = canonical.get(`${skill}/SKILL.md`);
      if (source === undefined) throw new Error(`Bundled canonical skill is missing: ${skill}`);
      const frontmatter = extractFrontmatter(source.toString("utf8"), `${skill}/SKILL.md`);
      const pointer = adapterPointer(hostRootPosix, skill);
      // A pointer is prose, not a link, but it must still resolve inside the install root.
      const pointerTarget = resolve(targetRoot, skill, ...pointer.split("/"));
      if (!isInside(root, pointerTarget))
        throw new Error(`Adapter pointer escapes the managed root: ${pointer}`);
      if (pointerTarget !== resolveInside(canonicalRoot, `${skill}/SKILL.md`))
        throw new Error(`Adapter pointer does not resolve to canonical content: ${pointer}`);
      hostFiles.set(
        `${skill}/SKILL.md`,
        Buffer.from(renderAdapter({ skill, pointer, frontmatter }))
      );
    }
    if (VERBATIM_PLATFORMS.has(platform))
      for (const [rel, bytes] of canonical) if (isVerbatimHostFile(rel)) hostFiles.set(rel, bytes);

    for (const [rel, bytes] of [...hostFiles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const target = resolveInside(targetRoot, rel);
      await assertNoSymlinkPath(root, target);
      const manifestRelative = toPosix(relative(root, target));
      assertSafeRelative(manifestRelative);
      planned.push(
        await planFileWrite({
          root,
          manifestRelative,
          target,
          bytes,
          previous,
          platform,
          kind: "adapter"
        })
      );
      plannedPaths.add(manifestRelative);
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
              platform,
              kind: "instructions"
            },
            target,
            bytes,
            record: { hash, platform, owned, management: "file", kind: "instructions" },
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
              platform,
              kind: "instructions"
            },
            target,
            bytes: Buffer.from(nextContent, "utf8"),
            record: {
              hash: nextHash,
              platform,
              owned,
              management: "section",
              kind: "instructions"
            },
            ...(currentFileHash === undefined ? {} : { previousHash: currentFileHash })
          });
        }
        plannedPaths.add(manifestRelative);
      }
    }
  }

  // 3. Migration: retire previous-layout files this install no longer owns. Only Forge-owned,
  //    unmodified files are removed; anything the user changed is preserved and reported.
  const selected = new Set(platforms);
  const retirable: Array<{ action: InstallAction; target: string; expectedHash: string }> = [];
  const retainedCanonical = new Map<string, InstallFile>();
  for (const [rel, record] of Object.entries(previous.files).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (plannedPaths.has(rel)) continue;
    if (record.kind === "canonical") {
      const owners = record.platforms ?? [record.platform];
      const selectedOwners = owners.filter((platform) => selected.has(platform as Platform));
      if (selectedOwners.length === 0) continue;
      const retainedOwners = owners.filter((platform) => !selected.has(platform as Platform));
      if (retainedOwners.length > 0) {
        // A canonical file is shared. Updating one host must not retire content still owned by a
        // host that was deliberately left out of this invocation.
        retainedCanonical.set(rel, {
          ...record,
          kind: "canonical",
          platforms: retainedOwners,
          platform: retainedOwners[0] as string
        });
        continue;
      }
    } else if (!selected.has(record.platform as Platform)) continue;
    assertSafeRelative(rel);
    const target = resolveInside(root, rel);
    await assertNoSymlinkPath(root, target);
    const currentHash = await hashIfPresent(target);
    if (currentHash === undefined) {
      // Already retired by an interrupted earlier attempt; just drop the stale record.
      retirable.push({
        action: {
          action: "remove",
          path: rel,
          platform: record.platform as Platform,
          kind: "retired"
        },
        target,
        expectedHash: record.hash
      });
      continue;
    }
    if (!record.owned || currentHash !== record.hash) {
      retirable.push({
        action: {
          action: "preserve-modified",
          path: rel,
          platform: record.platform as Platform,
          kind: "retired"
        },
        target,
        expectedHash: record.hash
      });
      continue;
    }
    retirable.push({
      action: {
        action: "remove",
        path: rel,
        platform: record.platform as Platform,
        kind: "retired"
      },
      target,
      expectedHash: record.hash
    });
  }

  if (options.dryRun)
    return [...planned.map((item) => item.action), ...retirable.map((item) => item.action)];

  const next: InstallManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    packageVersion: VERSION,
    root,
    installedAt: utcNow(),
    agent_first: true,
    automatic_activation: !options.global,
    files: { ...previous.files, ...Object.fromEntries(retainedCanonical) }
  };

  // Claim every path that was absent during the complete preflight before creating any managed
  // file. If the process is interrupted after this atomic manifest write, a retry can safely
  // recreate missing owned files instead of mistaking partially installed files for pre-existing
  // unowned content. Existing and update targets retain their prior records until their bytes are
  // safely replaced, so either the old or new hash remains recoverable after a crash.
  const created = planned.filter((item) => item.action.action === "create");
  if (created.length > 0) {
    const prepared: InstallManifest = { ...next, files: { ...next.files } };
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
    next.files[item.action.path] = mergeCanonicalRecord(next.files[item.action.path], item.record);
  }
  await writeManifest(root, next);

  // Retirement runs only after every new file is durably in place, so an interruption leaves both
  // layouts present and usable. The manifest still records anything not yet retired, so a rerun
  // resumes exactly where it stopped.
  if (retirable.length > 0) {
    const prunable = new Set<string>();
    for (const item of retirable) {
      if (item.action.action === "remove") {
        const removal = await unlinkIfUnchanged(root, item.target, item.expectedHash);
        if (removal === "modified") item.action.action = "preserve-modified";
        else if (removal === "removed") prunable.add(dirname(item.target));
      }
      // A user-modified stale file is preserved as user content, not retained as Forge-owned
      // state. Leaving the obsolete record behind makes doctor treat the preserved bytes as a
      // damaged managed installation and lets a retired skill inflate the installed-skill count.
      delete next.files[item.action.path];
    }
    await writeManifest(root, next);
    for (const directory of [...prunable].sort((a, b) => b.length - a.length))
      await pruneEmptyDirectories(root, directory);
  }

  return [...planned.map((item) => item.action), ...retirable.map((item) => item.action)];
}

async function planFileWrite(input: {
  root: string;
  manifestRelative: string;
  target: string;
  bytes: Buffer;
  previous: InstallManifest;
  platform: Platform;
  kind: "canonical" | "adapter";
  platforms?: Platform[];
}): Promise<PlannedWrite> {
  const { manifestRelative, target, bytes, previous, platform, kind } = input;
  const hash = sha256(bytes);
  const oldRecord = previous.files[manifestRelative];
  const existingHash = await hashIfPresent(target);

  if (oldRecord !== undefined) {
    if (kind !== "canonical" && oldRecord.platform !== platform)
      throw new Error(`Ownership platform mismatch for ${manifestRelative}`);
    if (
      oldRecord.owned &&
      existingHash !== undefined &&
      existingHash !== oldRecord.hash &&
      existingHash !== hash
    )
      throw new Error(`Refusing to overwrite a modified owned file: ${manifestRelative}`);
    if (!oldRecord.owned && existingHash !== hash)
      throw new Error(`Refusing to update a pre-existing unowned file: ${manifestRelative}`);
  } else if (existingHash !== undefined && existingHash !== hash) {
    throw new Error(`Refusing to overwrite an unowned file: ${manifestRelative}`);
  }

  const owned = oldRecord?.owned ?? existingHash === undefined;
  const action: InstallAction["action"] =
    existingHash === undefined ? "create" : existingHash === hash ? "preserve-identical" : "update";
  const record: InstallFile = { hash, platform, owned, management: "file", kind };
  if (kind === "canonical") {
    const merged = new Set<string>([...(oldRecord?.platforms ?? []), ...(input.platforms ?? [])]);
    record.platforms = [...merged].sort();
    record.platform = record.platforms[0] ?? platform;
  }
  return {
    action: { action, path: manifestRelative, platform: record.platform as Platform, kind },
    target,
    bytes,
    record,
    ...(existingHash === undefined ? {} : { previousHash: existingHash })
  };
}

/** Canonical records accumulate the set of hosts that depend on them. */
function mergeCanonicalRecord(existing: InstallFile | undefined, next: InstallFile): InstallFile {
  if (next.kind !== "canonical") return next;
  const merged = new Set<string>([...(existing?.platforms ?? []), ...(next.platforms ?? [])]);
  const platforms = [...merged].sort();
  return { ...next, platforms, platform: platforms[0] ?? next.platform };
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
  const prunable = new Set<string>();
  for (const [rel, record] of Object.entries(manifest.files).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    assertSafeRelative(rel);
    const target = resolveInside(root, rel);

    if (record.kind === "canonical") {
      const owners = record.platforms ?? [record.platform];
      const retained = owners.filter((platform) => !selected.has(platform as Platform));
      if (retained.length === owners.length) continue;
      if (retained.length > 0) {
        // Another installed host still depends on this canonical file; keep it and record the
        // narrowed owner set instead of orphaning or deleting shared content.
        remaining[rel] = {
          ...record,
          platforms: retained,
          platform: retained[0] ?? record.platform
        };
        continue;
      }
    } else if (!selected.has(record.platform as Platform)) continue;

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
          platform: record.platform as Platform,
          ...(record.kind === undefined ? {} : { kind: record.kind })
        });
        continue;
      }
      if (options.dryRun) {
        actions.push({
          action: "remove",
          path: rel,
          platform: record.platform as Platform,
          ...(record.kind === undefined ? {} : { kind: record.kind })
        });
        continue;
      }
      const removal = await removeSectionIfUnchanged(root, target, record.hash);
      actions.push({
        action: removal.status === "modified" ? "preserve-modified" : "remove",
        path: rel,
        platform: record.platform as Platform,
        ...(record.kind === undefined ? {} : { kind: record.kind })
      });
      if (removal.status === "modified") continue;
      delete remaining[rel];
      if (removal.prunable) prunable.add(dirname(target));
      continue;
    }
    if (currentHash !== record.hash) {
      actions.push({
        action: "preserve-modified",
        path: rel,
        platform: record.platform as Platform,
        ...(record.kind === undefined ? {} : { kind: record.kind })
      });
      continue;
    }
    if (options.dryRun) {
      actions.push({
        action: "remove",
        path: rel,
        platform: record.platform as Platform,
        ...(record.kind === undefined ? {} : { kind: record.kind })
      });
      continue;
    }
    const removal = await unlinkIfUnchanged(root, target, record.hash);
    actions.push({
      action: removal === "modified" ? "preserve-modified" : "remove",
      path: rel,
      platform: record.platform as Platform,
      ...(record.kind === undefined ? {} : { kind: record.kind })
    });
    if (removal === "modified") continue;
    delete remaining[rel];
    if (removal === "removed") prunable.add(dirname(target));
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
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        files: remaining,
        installedAt: utcNow(),
        automatic_activation: Object.entries(remaining).some(([rel, record]) => {
          const instruction = PROJECT_INSTRUCTIONS[record.platform as Platform];
          return instruction !== undefined && instruction.path.join("/") === rel;
        })
      });
    }
    for (const directory of [...prunable].sort((a, b) => b.length - a.length))
      await pruneEmptyDirectories(root, directory);
  }
  return actions;
}

/**
 * Removes managed directories that removal left empty, walking upward until a non-empty directory
 * or the install root is reached. A directory holding any user file is never removed.
 */
async function pruneEmptyDirectories(root: string, start: string): Promise<void> {
  let current = start;
  while (isInside(root, current) && current !== root) {
    let entries;
    try {
      entries = await readdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        current = dirname(current);
        continue;
      }
      return;
    }
    if (entries.length > 0) return;
    try {
      await rmdir(current);
    } catch {
      return;
    }
    current = dirname(current);
  }
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

/** The canonical managed root, relative to an installation root. */
export function canonicalManagedRoot(): string {
  return CANONICAL_ROOT_POSIX;
}

async function readManifest(
  root: string,
  required = false,
  providedInventory?: ManagedPathInventory
): Promise<InstallManifest> {
  const path = resolveInside(root, MANIFEST_RELATIVE);
  // The manifest is authority to overwrite and delete. Never follow a user-controlled link while
  // acquiring that authority, including a link at the manifest filename itself.
  await assertNoSymlinkPath(root, path);
  const text = await readTextIfPresent(path);
  if (text === undefined) {
    if (required) throw new Error(`No Fullstack Forge ownership manifest at ${path}`);
    return {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
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
    (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) ||
    parsed.root !== root ||
    typeof parsed.packageVersion !== "string" ||
    typeof parsed.installedAt !== "string" ||
    !isRecord(parsed.files) ||
    ("agent_first" in parsed && typeof parsed.agent_first !== "boolean") ||
    ("automatic_activation" in parsed && typeof parsed.automatic_activation !== "boolean")
  ) {
    throw new Error(`Unsafe or unsupported ownership manifest at ${path}`);
  }
  const inventory = providedInventory ?? (await readManagedPathInventory());
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
      ("management" in record && record.management !== "file" && record.management !== "section") ||
      ("kind" in record &&
        record.kind !== "canonical" &&
        record.kind !== "adapter" &&
        record.kind !== "instructions" &&
        record.kind !== "retired") ||
      ("platforms" in record &&
        (!Array.isArray(record.platforms) ||
          record.platforms.length === 0 ||
          record.platforms.some((value) => !PLATFORMS.includes(value as Platform))))
    ) {
      throw new Error(`Invalid ownership record for ${rel}`);
    }
    const management = record.management === "section" ? "section" : "file";
    const inferredKind = classifyManagedManifestPath(
      rel,
      record.platform as Platform,
      management,
      inventory
    );
    const kind =
      typeof record.kind === "string" ? (record.kind as InstallFile["kind"]) : inferredKind;
    const normalizedRecord: InstallFile = {
      platform: record.platform,
      hash: record.hash,
      owned: record.owned,
      management,
      ...(kind === undefined ? {} : { kind }),
      ...(Array.isArray(record.platforms)
        ? { platforms: [...new Set(record.platforms as string[])].sort() }
        : {})
    };
    assertManagedManifestPath(rel, normalizedRecord, inventory, parsed.packageVersion);
    files[rel] = normalizedRecord;
  }
  return {
    schemaVersion: parsed.schemaVersion,
    packageVersion: parsed.packageVersion,
    root,
    installedAt: parsed.installedAt,
    agent_first: parsed.agent_first === true,
    automatic_activation: parsed.automatic_activation === true,
    files
  };
}

function assertManagedManifestPath(
  rel: string,
  record: InstallFile,
  inventory: ManagedPathInventory,
  packageVersion: string
): void {
  if (rel.includes("\\"))
    throw new Error(`Ownership record must use a canonical forward-slash path: ${rel}`);
  const accepted =
    record.kind === "canonical" &&
    record.management !== "section" &&
    (inventory.canonicalPaths.has(rel) || inventory.supportPaths.has(rel))
      ? true
      : record.kind === "instructions" &&
          isInstructionPath(rel, record.platform as Platform, record.management)
        ? true
        : record.kind === "adapter" &&
            record.management !== "section" &&
            inventory.adapterPaths.get(record.platform as Platform)?.has(rel) === true
          ? true
          : record.kind === "retired" &&
            record.management !== "section" &&
            inventory.legacyHostPaths.get(record.platform as Platform)?.has(rel) === true &&
            inventory.adapterPaths.get(record.platform as Platform)?.has(rel) !== true;
  if (!accepted)
    throw new Error(`Ownership record path is outside Fullstack Forge managed paths: ${rel}`);
  if (
    inventory.expectedHashes.get(rel)?.has(record.hash) !== true &&
    !legacyHashMatches(packageVersion, rel, record.hash, VERSION)
  )
    throw new Error(`Ownership record hash does not match bundled managed content: ${rel}`);
}

function classifyManagedManifestPath(
  path: string,
  platform: Platform,
  management: InstallFile["management"],
  inventory: ManagedPathInventory
): InstallFile["kind"] | undefined {
  if (isInstructionPath(path, platform, management)) return "instructions";
  if (management === "section") return undefined;
  if (inventory.canonicalPaths.has(path) || inventory.supportPaths.has(path)) return "canonical";
  // Adapter paths are a strict subset of the legacy full-copy inventory and must win. This lets a
  // schema-1 global bare update infer its installed host from the surviving SKILL.md records.
  if (inventory.adapterPaths.get(platform)?.has(path) === true) return "adapter";
  if (inventory.legacyHostPaths.get(platform)?.has(path) === true) return "retired";
  return undefined;
}

function isInstructionPath(
  path: string,
  platform: Platform,
  management: InstallFile["management"]
): boolean {
  const instruction = PROJECT_INSTRUCTIONS[platform];
  return (
    instruction !== undefined &&
    path === instruction.path.join("/") &&
    management === instruction.management
  );
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

/**
 * Revalidates both link topology and bytes immediately before deletion. The first read is the
 * normal ownership check; the second closes the much larger preflight-to-commit race window.
 */
async function unlinkIfUnchanged(
  root: string,
  target: string,
  expectedHash: string
): Promise<"removed" | "missing" | "modified"> {
  await assertNoSymlinkPath(root, target);
  const observed = await hashIfPresent(target);
  if (observed === undefined) return "missing";
  if (observed !== expectedHash) return "modified";
  await assertNoSymlinkPath(root, target);
  const finalHash = await hashIfPresent(target);
  if (finalHash === undefined) return "missing";
  if (finalHash !== expectedHash) return "modified";
  await unlink(target);
  return "removed";
}

async function removeSectionIfUnchanged(
  root: string,
  target: string,
  expectedSectionHash: string
): Promise<{ status: "removed" | "missing" | "modified"; prunable: boolean }> {
  await assertNoSymlinkPath(root, target);
  const observed = await readTextIfPresent(target);
  if (observed === undefined) return { status: "missing", prunable: false };
  const observedSection = safeManagedSection(observed);
  if (observedSection === undefined || sha256(observedSection) !== expectedSectionHash)
    return { status: "modified", prunable: false };

  await assertNoSymlinkPath(root, target);
  const latest = await readTextIfPresent(target);
  if (latest === undefined) return { status: "missing", prunable: false };
  // Preserve edits outside the managed section too; rewriting a stale snapshot would otherwise
  // discard concurrent user content even though the section itself still matched.
  if (sha256(latest) !== sha256(observed)) return { status: "modified", prunable: false };
  const latestSection = safeManagedSection(latest);
  if (latestSection === undefined || sha256(latestSection) !== expectedSectionHash)
    return { status: "modified", prunable: false };

  const next = removeManagedSection(latest);
  if (next.length === 0) {
    await unlink(target);
    return { status: "removed", prunable: true };
  }
  await atomicWrite(root, target, Buffer.from(next, "utf8"));
  return { status: "removed", prunable: false };
}

function safeManagedSection(content: string): string | undefined {
  try {
    return extractManagedSection(content);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
