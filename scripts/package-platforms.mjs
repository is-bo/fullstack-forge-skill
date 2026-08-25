import { Buffer } from "node:buffer";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import {
  assertNoSymlinkPath,
  assertRegularFile,
  assertSafeRelativePath
} from "./lib/fs-safety.mjs";
import { assertDistributionInventory } from "./lib/dist-safety.mjs";
import { createDeterministicZip } from "./lib/zip.mjs";
import { assertPublishableArchivePath, packageCommonPaths } from "./lib/package-policy.mjs";
import { loadPackageOwnership } from "./lib/package-ownership.mjs";
import { createReleaseBundle } from "./lib/release-bundle.mjs";
import { platformTargets, projectRoot, sha256 } from "./project.mjs";

const dryRun = process.argv.includes("--dry-run");
const requireCleanInputs = process.argv.includes("--require-clean-inputs");
const version = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).version;
const distRoot = join(projectRoot, "dist");
const ownershipPath = join(distRoot, ".fullstack-forge-dist-manifest.json");
await assertNoSymlinkPath(projectRoot, distRoot);
await assertNoSymlinkPath(projectRoot, ownershipPath);
const common = packageCommonPaths(version);
const packageOwnership = await loadPackageOwnership(projectRoot);
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

// Every archive is a self-contained Forge installation: host adapters, canonical contracts,
// composition manifests, and the exact compiled upstream guidance those manifests resolve.
// Collected once and reused, since the bytes are identical per archive.
const managedEntries = [];
{
  for (const relativeRoot of ["skills", "upstream", "manifests", "runtime"]) {
    const managedRoot = join(projectRoot, ".fullstack-forge", relativeRoot);
    await assertNoSymlinkPath(projectRoot, managedRoot);
    for (const file of await walk(managedRoot)) {
      const entryPath = relative(projectRoot, file).split(sep).join("/");
      assertPublishableArchivePath(entryPath, version, packageOwnership.paths);
      managedEntries.push({ path: entryPath, data: await readFile(file) });
    }
  }
}
for (const required of [
  ".fullstack-forge/skills/fullstack-forge/SKILL.md",
  ".fullstack-forge/manifests/module-composition.json",
  ".fullstack-forge/manifests/upstream-registry.json",
  ".fullstack-forge/runtime/cli/src/composition-entry.js"
])
  if (!managedEntries.some((entry) => entry.path === required))
    throw new Error(`Managed archive content is incomplete: ${required} is missing`);

const previous = await readOwnership();
const outputs = new Map();
for (const archive of archives) {
  const entries = [];
  for (const path of common) {
    assertPublishableArchivePath(path, version, packageOwnership.paths);
    entries.push({ path, data: await readRequired(join(projectRoot, ...path.split("/"))) });
  }
  entries.push(...managedEntries);
  for (const id of archive.platforms) {
    const platform = byId.get(id);
    if (platform === undefined) throw new Error(`Unknown package platform ${id}`);
    const platformRoot = join(projectRoot, ...platform.path.split("/"));
    await assertNoSymlinkPath(projectRoot, platformRoot);
    for (const file of await walk(platformRoot)) {
      const entryPath = relative(projectRoot, file).split(sep).join("/");
      assertPublishableArchivePath(entryPath, version, packageOwnership.paths);
      entries.push({ path: entryPath, data: await readFile(file) });
    }
  }
  outputs.set(archive.name, createDeterministicZip(entries));
}

const archiveOutputs = [...outputs.entries()];
const releaseBundle = await createReleaseBundle({ projectRoot, version, requireCleanInputs });
outputs.set(releaseBundle.names.package, releaseBundle.packageBytes);
outputs.set(releaseBundle.names.sbom, releaseBundle.sbomBytes);

const checksumLines = [...outputs.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, bytes]) => `${sha256(bytes)}  ${name}`);
const packageManifest = {
  schemaVersion: 2,
  version,
  deterministic: true,
  source: releaseBundle.sourceIdentity,
  timestampPolicy:
    "ZIP entries use 1980-01-01 00:00:00; npm package and SPDX bytes must match two independent deterministic generations",
  artifacts: Object.fromEntries(
    [...outputs.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [
        name,
        {
          kind:
            name === releaseBundle.names.package
              ? "npm-package"
              : name === releaseBundle.names.sbom
                ? "spdx-sbom"
                : "platform-archive",
          mediaType:
            name === releaseBundle.names.package
              ? "application/gzip"
              : name === releaseBundle.names.sbom
                ? "application/spdx+json"
                : "application/zip",
          sha256: sha256(bytes),
          bytes: bytes.length
        }
      ])
  ),
  archives: Object.fromEntries(
    archiveOutputs
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [name, { sha256: sha256(bytes), bytes: bytes.length }])
  ),
  npmPackage: { name: releaseBundle.names.package, ...releaseBundle.packageReport },
  sbom: { name: releaseBundle.names.sbom, format: "SPDX-2.3" }
};
outputs.set("SHA256SUMS.txt", Buffer.from(`${checksumLines.join("\n")}\n`, "utf8"));
outputs.set("manifest.json", Buffer.from(`${JSON.stringify(packageManifest, null, 2)}\n`, "utf8"));
await assertExistingDistInventory(previous, outputs);

for (const [name, bytes] of outputs) {
  const path = join(distRoot, name);
  await assertNoSymlinkPath(projectRoot, path);
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
  for (const [name, bytes] of outputs) {
    const path = join(distRoot, name);
    await assertNoSymlinkPath(projectRoot, path);
    await writeFile(path, bytes);
  }
  await assertNoSymlinkPath(projectRoot, ownershipPath);
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

async function assertExistingDistInventory(previous, outputs) {
  const allowed = new Set([
    basename(ownershipPath),
    ...outputs.keys(),
    ...Object.keys(previous.files ?? {})
  ]);
  await assertDistributionInventory(projectRoot, distRoot, allowed);
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
