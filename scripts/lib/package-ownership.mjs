import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { assertNoSymlinkPath, assertRegularFile } from "./fs-safety.mjs";
import { GENERATED_OWNERSHIP_FILENAME, parseGeneratedOwnership } from "./generated-ownership.mjs";
import { PACKAGE_OWNERSHIP_ROOTS } from "./package-policy.mjs";

export async function loadPackageOwnership(projectRoot) {
  const paths = new Set();
  const hashes = new Map();
  for (const definition of PACKAGE_OWNERSHIP_ROOTS) {
    const root = join(projectRoot, ...definition.root.split("/"));
    const markerPath = join(root, GENERATED_OWNERSHIP_FILENAME);
    await assertNoSymlinkPath(projectRoot, root);
    await assertNoSymlinkPath(projectRoot, markerPath);
    await assertUnlinkedRegularFile(markerPath, `${definition.platform} ownership manifest`);
    const markerBytes = await readFile(markerPath);
    const records = parseGeneratedOwnership(
      markerBytes,
      definition.platform,
      `${definition.root}/${GENERATED_OWNERSHIP_FILENAME}`
    );
    const actual = await readOwnedRoot(root);
    assertExactOwnedRoot(definition.root, records, actual);
    for (const [relativePath, hash] of records) {
      const packagePath = `${definition.root}/${relativePath}`;
      paths.add(packagePath);
      hashes.set(packagePath, hash);
    }
    const markerPackagePath = `${definition.root}/${GENERATED_OWNERSHIP_FILENAME}`;
    paths.add(markerPackagePath);
    hashes.set(markerPackagePath, sha256(markerBytes));
  }
  return { paths, hashes };
}

export function validatePackagedOwnership(entries, archiveName) {
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  const paths = new Set();
  const hashes = new Map();
  for (const definition of PACKAGE_OWNERSHIP_ROOTS) {
    const prefix = `${definition.root}/`;
    const present = entries.filter((entry) => entry.name.startsWith(prefix));
    if (present.length === 0) continue;
    const markerName = `${prefix}${GENERATED_OWNERSHIP_FILENAME}`;
    const markerBytes = byName.get(markerName);
    if (markerBytes === undefined)
      throw new Error(`${archiveName}:${definition.root} has no generated ownership manifest`);
    const records = parseGeneratedOwnership(markerBytes, definition.platform, markerName);
    const actual = new Map(
      present
        .filter((entry) => entry.name !== markerName)
        .map((entry) => [entry.name.slice(prefix.length), sha256(entry.data)])
    );
    assertExactOwnedRoot(`${archiveName}:${definition.root}`, records, actual);
    for (const [relativePath, hash] of records) {
      const packagePath = `${prefix}${relativePath}`;
      paths.add(packagePath);
      hashes.set(packagePath, hash);
    }
    paths.add(markerName);
    hashes.set(markerName, sha256(markerBytes));
  }
  return { paths, hashes };
}

function assertExactOwnedRoot(label, expected, actual) {
  for (const [path, hash] of expected) {
    const actualHash = actual.get(path);
    if (actualHash === undefined) throw new Error(`${label} is missing owned file ${path}`);
    if (actualHash !== hash) throw new Error(`${label} has modified owned file ${path}`);
  }
  for (const path of actual.keys())
    if (!expected.has(path)) throw new Error(`${label} contains unowned file ${path}`);
}

async function readOwnedRoot(root) {
  const files = new Map();
  for (const path of await walk(root)) {
    const relativePath = relative(root, path).split(sep).join("/");
    if (relativePath === GENERATED_OWNERSHIP_FILENAME) continue;
    await assertNoSymlinkPath(root, path);
    await assertUnlinkedRegularFile(path, "owned package input");
    files.set(relativePath, sha256(await readFile(path)));
  }
  return files;
}

async function assertUnlinkedRegularFile(path, label) {
  const info = await assertRegularFile(path, label);
  if (info.nlink !== 1)
    throw new Error(`Hard-linked ${label} is forbidden (nlink=${info.nlink}): ${path}`);
  return info;
}

async function walk(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in package ownership root: ${path}`);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else if (entry.isFile()) output.push(path);
    else throw new Error(`Unsupported package ownership entry: ${path}`);
  }
  return output;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
