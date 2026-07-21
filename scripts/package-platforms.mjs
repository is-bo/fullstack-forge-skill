import { Buffer } from "node:buffer";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import {
  assertNoSymlinkPath,
  assertRegularFile,
  assertSafeRelativePath
} from "./lib/fs-safety.mjs";
import { createDeterministicZip } from "./lib/zip.mjs";
import { assertPublishableArchivePath, packageCommonPaths } from "./lib/package-policy.mjs";
import { platformTargets, projectRoot, sha256 } from "./project.mjs";

const dryRun = process.argv.includes("--dry-run");
const version = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).version;
const distRoot = join(projectRoot, "dist");
const ownershipPath = join(distRoot, ".fullstack-forge-dist-manifest.json");
await assertNoSymlinkPath(projectRoot, distRoot);
await assertNoSymlinkPath(projectRoot, ownershipPath);
const common = packageCommonPaths(version);
const byId = new Map(platformTargets.map((target) => [target.id, target]));
const archives = [
  {
    name: `fullstack-forge-all-v${version}.zip`,
    platforms: platformTargets.map((target) => target.id)
  },
  { name: `fullstack-forge-claude-v${version}.zip`, platforms: ["claude"] },
  { name: `fullstack-forge-codex-v${version}.zip`, platforms: ["agents"] },
  { name: `fullstack-forge-antigravity-v${version}.zip`, platforms: ["agents"] },
  { name: `fullstack-forge-gemini-v${version}.zip`, platforms: ["gemini"] },
  { name: `fullstack-forge-generic-v${version}.zip`, platforms: ["agents"] },
  { name: `fullstack-forge-cursor-v${version}.zip`, platforms: ["cursor"] },
  { name: `fullstack-forge-windsurf-v${version}.zip`, platforms: ["windsurf"] },
  { name: `fullstack-forge-github-v${version}.zip`, platforms: ["github"] }
];

const previous = await readOwnership();
const outputs = new Map();
for (const archive of archives) {
  const entries = [];
  for (const path of common) {
    assertPublishableArchivePath(path, version);
    entries.push({ path, data: await readRequired(join(projectRoot, ...path.split("/"))) });
  }
  for (const id of archive.platforms) {
    const platform = byId.get(id);
    if (platform === undefined) throw new Error(`Unknown package platform ${id}`);
    const platformRoot = join(projectRoot, ...platform.path.split("/"));
    await assertNoSymlinkPath(projectRoot, platformRoot);
    for (const file of await walk(platformRoot)) {
      if (basename(file) === ".fullstack-forge-generated.json") continue;
      const entryPath = relative(projectRoot, file).split(sep).join("/");
      assertPublishableArchivePath(entryPath, version);
      entries.push({ path: entryPath, data: await readFile(file) });
    }
  }
  outputs.set(archive.name, createDeterministicZip(entries));
}

const checksumLines = [...outputs.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, bytes]) => `${sha256(bytes)}  ${name}`);
const packageManifest = {
  schemaVersion: 1,
  version,
  deterministic: true,
  timestampPolicy: "ZIP entries use 1980-01-01 00:00:00",
  archives: Object.fromEntries(
    [...outputs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length }])
  )
};
outputs.set("SHA256SUMS.txt", Buffer.from(`${checksumLines.join("\n")}\n`, "utf8"));
outputs.set("manifest.json", Buffer.from(`${JSON.stringify(packageManifest, null, 2)}\n`, "utf8"));

for (const [name, bytes] of outputs) {
  const path = join(distRoot, name);
  let current;
  try {
    current = await readFile(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (
    current !== undefined &&
    sha256(current) !== sha256(bytes) &&
    previous.files?.[name] !== sha256(current)
  ) {
    throw new Error(`Refusing to overwrite unowned or modified distribution file ${path}`);
  }
}

const staleOwned = [];
for (const [name, expectedHash] of Object.entries(previous.files)) {
  if (outputs.has(name)) continue;
  assertSafeRelativePath(name, "distribution ownership path");
  if (basename(name) !== name)
    throw new Error(`Distribution ownership records must be root-level files: ${name}`);
  const path = join(distRoot, name);
  await assertNoSymlinkPath(projectRoot, path);
  let current;
  try {
    await assertRegularFile(path, "owned distribution file");
    current = await readFile(path);
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  if (sha256(current) !== expectedHash)
    throw new Error(`Refusing to remove modified owned distribution file ${path}`);
  staleOwned.push({ name, path });
}

const ownership = {
  schemaVersion: 1,
  generator: "fullstack-forge",
  files: Object.fromEntries(
    [...outputs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [name, sha256(bytes)])
  )
};
if (!dryRun) {
  await mkdir(distRoot, { recursive: true });
  for (const item of staleOwned) await unlink(item.path);
  for (const [name, bytes] of outputs) await writeFile(join(distRoot, name), bytes);
  await writeFile(ownershipPath, `${JSON.stringify(ownership, null, 2)}\n`, "utf8");
}
console.log(
  JSON.stringify(
    {
      dry_run: dryRun,
      version,
      files: Object.keys(ownership.files),
      removed_owned: staleOwned.map((item) => item.name)
    },
    null,
    2
  )
);

async function readOwnership() {
  try {
    const parsed = JSON.parse(await readFile(ownershipPath, "utf8"));
    if (
      parsed.schemaVersion !== 1 ||
      parsed.generator !== "fullstack-forge" ||
      typeof parsed.files !== "object" ||
      parsed.files === null ||
      Array.isArray(parsed.files)
    ) {
      throw new Error(`Invalid distribution ownership manifest ${ownershipPath}`);
    }
    for (const [name, hash] of Object.entries(parsed.files)) {
      assertSafeRelativePath(name, "distribution ownership path");
      if (basename(name) !== name || typeof hash !== "string" || !/^[a-f0-9]{64}$/u.test(hash))
        throw new Error(`Invalid distribution ownership record ${name}`);
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return { files: {} };
    throw error;
  }
}

async function readRequired(path) {
  try {
    await assertRegularFile(path, "package input");
    return await readFile(path);
  } catch (error) {
    throw new Error(`Required package input is missing: ${path} (${error.message})`, {
      cause: error
    });
  }
}

async function walk(root) {
  const files = [];
  for (const entry of await (
    await import("node:fs/promises")
  ).readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are forbidden in packages: ${path}`);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
