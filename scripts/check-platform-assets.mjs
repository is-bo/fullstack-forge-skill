import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { assertNoSymlinkPath, assertSafeRelativePath } from "./lib/fs-safety.mjs";
import {
  canonicalRoot,
  commandRoot,
  expectedSlugs,
  manifestName,
  platformTargets,
  projectRoot,
  sha256
} from "./project.mjs";

const expected = await collectExpectedFiles();
const failures = [];
for (const platform of platformTargets) {
  const root = join(projectRoot, ...platform.path.split("/"));
  const manifestPath = join(root, manifestName);
  let manifest;
  try {
    await assertNoSymlinkPath(projectRoot, root);
    await assertNoSymlinkPath(projectRoot, manifestPath);
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    validateManifest(manifest, platform.id);
  } catch (error) {
    failures.push(`${platform.id}: missing or invalid manifest (${error.message})`);
    continue;
  }
  const recorded = manifest.files ?? {};
  for (const [rel, expectedHash] of expected) {
    if (recorded[rel] !== expectedHash)
      failures.push(`${platform.id}: manifest differs from canonical: ${rel}`);
    try {
      const actualHash = sha256(await readFile(join(root, ...rel.split("/"))));
      if (actualHash !== expectedHash)
        failures.push(`${platform.id}: file differs from canonical: ${rel}`);
    } catch (error) {
      failures.push(`${platform.id}: missing ${rel} (${error.message})`);
    }
  }
  for (const rel of Object.keys(recorded)) {
    if (!expected.has(rel)) failures.push(`${platform.id}: stale manifest entry: ${rel}`);
  }
  for (const file of await walk(root)) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel === manifestName || !isManaged(rel)) continue;
    if (!expected.has(rel)) failures.push(`${platform.id}: unknown managed file: ${rel}`);
  }
}

function validateManifest(value, platform) {
  if (
    value.schemaVersion !== 1 ||
    value.generator !== "fullstack-forge" ||
    value.platform !== platform ||
    typeof value.files !== "object" ||
    value.files === null ||
    Array.isArray(value.files)
  )
    throw new Error("unsupported ownership metadata");
  for (const [rel, hash] of Object.entries(value.files)) {
    assertSafeRelativePath(rel, "generated manifest path");
    if (!isManaged(rel) || typeof hash !== "string" || !/^[a-f0-9]{64}$/u.test(hash))
      throw new Error(`unsafe ownership record ${rel}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `All ${platformTargets.length} platform roots match ${expected.size} canonical files and their ownership manifests.`
  );
}

async function collectExpectedFiles() {
  const files = new Map();
  for (const path of await walk(canonicalRoot)) {
    const rel = relative(canonicalRoot, path).split(sep).join("/");
    if (rel.startsWith("commands/")) continue;
    files.set(`fullstack-forge/${rel}`, sha256(await readFile(path)));
  }
  for (const slug of expectedSlugs) {
    const rel = `forge-${slug}/SKILL.md`;
    files.set(rel, sha256(await readFile(join(commandRoot, `forge-${slug}`, "SKILL.md"))));
  }
  return files;
}

async function walk(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      failures.push(`symlink is forbidden in generated assets: ${path}`);
      continue;
    }
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function isManaged(rel) {
  const first = rel.split("/")[0] ?? "";
  return first === "fullstack-forge" || first.startsWith("forge-");
}
