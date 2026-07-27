// Generates the bundled managed-content layout.
//
// Previously this script wrote six byte-identical full copies of every managed file, one per agent
// host. It now writes ONE canonical copy under `.fullstack-forge/skills/` and a thin adapter
// `SKILL.md` per skill into each host root, plus the small documented verbatim exception for Codex
// (`agents/openai.yaml` and its `assets/`). No symlinks are used anywhere.

import { mkdir, readFile, readdir, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { assertNoSymlinkPath, assertSafeRelativePath } from "./lib/fs-safety.mjs";
import { writeFileWithTransientRetry } from "./lib/retry-write.mjs";
import {
  CANONICAL_ROOT_POSIX,
  adapterPointer,
  extractFrontmatter,
  hostVerbatimPaths,
  renderAdapter,
  skillNames
} from "./lib/managed-layout.mjs";
import {
  canonicalRoot,
  commandRoot,
  expectedBuildCommands,
  expectedSlugs,
  manifestName,
  platformTargets,
  projectRoot,
  sha256
} from "./project.mjs";

const canonicalFiles = await collectCanonicalFiles();
await synchronize(
  { id: "canonical", path: CANONICAL_ROOT_POSIX },
  canonicalFiles,
  isManagedCanonicalPath
);

const skills = skillNames(canonicalFiles.keys());
let adapterCount = 0;
for (const platform of platformTargets) {
  const files = buildHostFiles(platform, canonicalFiles, skills);
  adapterCount += skills.length;
  await synchronize(platform, files, isManagedCanonicalPath);
}

console.log(
  JSON.stringify(
    {
      canonical_root: CANONICAL_ROOT_POSIX,
      canonical_files: canonicalFiles.size,
      skills: skills.length,
      host_roots: platformTargets.length,
      adapters: adapterCount,
      verbatim_exception_files: platformTargets.reduce(
        (total, platform) => total + hostVerbatimPaths(platform.id, canonicalFiles.keys()).length,
        0
      )
    },
    null,
    2
  )
);

function buildHostFiles(platform, canonical, names) {
  const files = new Map();
  for (const skill of names) {
    const source = canonical.get(`${skill}/SKILL.md`);
    const frontmatter = extractFrontmatter(source.toString("utf8"), `${skill}/SKILL.md`);
    const pointer = adapterPointer(platform.path, skill);
    files.set(
      `${skill}/SKILL.md`,
      Buffer.from(renderAdapter({ skill, pointer, frontmatter }), "utf8")
    );
  }
  for (const rel of hostVerbatimPaths(platform.id, canonical.keys()))
    files.set(rel, canonical.get(rel));
  return files;
}

async function collectCanonicalFiles() {
  const files = new Map();
  for (const entry of await walk(canonicalRoot)) {
    const rel = relative(canonicalRoot, entry).split(sep).join("/");
    if (rel.startsWith("commands/")) continue;
    files.set(`fullstack-forge/${rel}`, await readFile(entry));
  }
  for (const slug of expectedSlugs) {
    const source = join(commandRoot, `forge-${slug}`, "SKILL.md");
    files.set(`forge-${slug}/SKILL.md`, await readFile(source));
  }
  for (const name of expectedBuildCommands) {
    const sourceRoot = join(commandRoot, name);
    for (const source of await walk(sourceRoot)) {
      const rel = relative(sourceRoot, source).split(sep).join("/");
      files.set(`${name}/${rel}`, await readFile(source));
    }
  }
  return files;
}

async function synchronize(platform, sourceFiles, isManaged) {
  const root = join(projectRoot, ...platform.path.split("/"));
  const manifestPath = join(root, manifestName);
  await assertNoSymlinkPath(projectRoot, root);
  await assertNoSymlinkPath(projectRoot, manifestPath);
  let previous = {
    schemaVersion: 1,
    generator: "fullstack-forge",
    platform: platform.id,
    files: {}
  };
  try {
    previous = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  validateManifest(previous, platform.id, isManaged);

  await guardOwnedDestinations(root, previous, sourceFiles, isManaged);
  await mkdir(root, { recursive: true });
  const nextFiles = {};
  for (const [rel, bytes] of [...sourceFiles.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    assertSafeRelativePath(rel, "generated path");
    const target = join(root, ...rel.split("/"));
    await assertNoSymlinkPath(root, target);
    await mkdir(dirname(target), { recursive: true });
    const hash = sha256(bytes);
    nextFiles[rel] = hash;
    let currentHash = "";
    try {
      currentHash = sha256(await readFile(target));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (currentHash !== hash) await writeFileWithTransientRetry(target, bytes);
  }

  // Retire files this root owned under the previous layout but no longer needs. Modified files are
  // never deleted, so a user edit inside a retired directory survives the migration.
  const retired = [];
  for (const [rel, oldHash] of Object.entries(previous.files ?? {})) {
    if (rel in nextFiles) continue;
    const target = join(root, ...rel.split("/"));
    await assertNoSymlinkPath(root, target);
    try {
      const currentHash = sha256(await readFile(target));
      if (currentHash !== oldHash)
        throw new Error(`Refusing to delete modified generated file ${target}`);
      await rm(target);
      retired.push(rel);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  await pruneEmptyDirectories(root);

  const manifest = {
    schemaVersion: 1,
    generator: "fullstack-forge",
    platform: platform.id,
    files: nextFiles
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  let currentManifest = "";
  try {
    currentManifest = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (currentManifest !== manifestText)
    await writeFileWithTransientRetry(manifestPath, manifestText, "utf8");
  return retired;
}

function isManagedCanonicalPath(rel) {
  const first = rel.split("/")[0] ?? "";
  return first === "fullstack-forge" || first === "forge" || first.startsWith("forge-");
}

function validateManifest(value, platform, isManaged) {
  if (
    typeof value !== "object" ||
    value === null ||
    value.schemaVersion !== 1 ||
    value.generator !== "fullstack-forge" ||
    value.platform !== platform ||
    typeof value.files !== "object" ||
    value.files === null ||
    Array.isArray(value.files)
  )
    throw new Error(`Unsafe generated ownership manifest for ${platform}`);
  for (const [rel, hash] of Object.entries(value.files)) {
    assertSafeRelativePath(rel, "generated manifest path");
    if (!isManaged(rel) || typeof hash !== "string" || !/^[a-f0-9]{64}$/u.test(hash))
      throw new Error(`Unsafe generated ownership record: ${rel}`);
  }
}

async function guardOwnedDestinations(root, previous, sourceFiles, isManaged) {
  try {
    if (!(await stat(root)).isDirectory())
      throw new Error(`Generated root is not a directory: ${root}`);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  const owned = previous.files ?? {};
  for (const file of await walk(root)) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel === manifestName) continue;
    if (isManaged(rel) && !sourceFiles.has(rel) && !(rel in owned)) {
      throw new Error(`Refusing unknown managed platform file ${file}`);
    }
  }
  for (const rel of sourceFiles.keys()) {
    const target = join(root, ...rel.split("/"));
    try {
      const currentHash = sha256(await readFile(target));
      const newHash = sha256(sourceFiles.get(rel));
      if (!(rel in owned) && currentHash !== newHash) {
        throw new Error(`Refusing to overwrite unowned platform file ${target}`);
      }
      if (rel in owned && currentHash !== owned[rel] && currentHash !== newHash) {
        throw new Error(`Refusing to overwrite modified generated file ${target}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

/** Removes directories left empty by retirement. User files keep their directory alive. */
async function pruneEmptyDirectories(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
  let empty = true;
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are forbidden in generated roots: ${path}`);
    if (entry.isDirectory()) {
      if (await pruneEmptyDirectories(path)) await rmdir(path);
      else empty = false;
    } else empty = false;
  }
  return empty;
}

async function walk(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Symlinks are forbidden in generated roots: ${path}`);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
