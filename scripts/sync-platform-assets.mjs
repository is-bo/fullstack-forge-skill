import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { assertNoSymlinkPath, assertSafeRelativePath } from "./lib/fs-safety.mjs";
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

const sourceFiles = await collectCanonicalFiles();
for (const platform of platformTargets) await synchronize(platform, sourceFiles);
console.log(`Synchronized ${sourceFiles.size} files to ${platformTargets.length} platform roots.`);

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
    const source = join(commandRoot, name, "SKILL.md");
    files.set(`${name}/SKILL.md`, await readFile(source));
  }
  return files;
}

async function synchronize(platform, sourceFiles) {
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
  validateManifest(previous, platform.id);

  await guardOwnedDestinations(root, previous, sourceFiles);
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
    if (currentHash !== hash) await writeFile(target, bytes);
  }

  for (const [rel, oldHash] of Object.entries(previous.files ?? {})) {
    if (rel in nextFiles) continue;
    const target = join(root, ...rel.split("/"));
    await assertNoSymlinkPath(root, target);
    try {
      const currentHash = sha256(await readFile(target));
      if (currentHash !== oldHash)
        throw new Error(`Refusing to delete modified generated file ${target}`);
      await rm(target);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const manifest = {
    schemaVersion: 1,
    generator: "fullstack-forge",
    platform: platform.id,
    files: nextFiles
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function validateManifest(value, platform) {
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
    const first = rel.split("/")[0] ?? "";
    if (
      (first !== "fullstack-forge" && !first.startsWith("forge-")) ||
      typeof hash !== "string" ||
      !/^[a-f0-9]{64}$/u.test(hash)
    )
      throw new Error(`Unsafe generated ownership record: ${rel}`);
  }
}

async function guardOwnedDestinations(root, previous, sourceFiles) {
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
    const first = rel.split("/")[0] ?? "";
    const managed = first === "fullstack-forge" || first.startsWith("forge-");
    if (managed && !sourceFiles.has(rel) && !(rel in owned)) {
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
