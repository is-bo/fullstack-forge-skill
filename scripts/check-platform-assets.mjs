// Verifies the bundled managed-content layout: exactly one canonical copy under
// `.fullstack-forge/skills/`, one thin adapter per skill in each host root, the documented Codex
// verbatim exception, matching ownership manifests, and no stale full-copy leftovers.

import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { assertNoSymlinkPath, assertSafeRelativePath } from "./lib/fs-safety.mjs";
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

const failures = [];
const canonical = await collectCanonicalFiles();
const skills = skillNames(canonical.keys());

const canonicalExpected = new Map(
  [...canonical.entries()].map(([rel, bytes]) => [rel, sha256(bytes)])
);
await verifyRoot({ id: "canonical", path: CANONICAL_ROOT_POSIX }, canonicalExpected);

let adapters = 0;
for (const platform of platformTargets) {
  const expected = new Map();
  for (const skill of skills) {
    const frontmatter = extractFrontmatter(
      canonical.get(`${skill}/SKILL.md`).toString("utf8"),
      `${skill}/SKILL.md`
    );
    const pointer = adapterPointer(platform.path, skill);
    expected.set(`${skill}/SKILL.md`, sha256(renderAdapter({ skill, pointer, frontmatter })));
    adapters += 1;
  }
  for (const rel of hostVerbatimPaths(platform.id, canonical.keys()))
    expected.set(rel, sha256(canonical.get(rel)));
  await verifyRoot(platform, expected);
  await verifyPointerTargets(platform);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        canonical_root: CANONICAL_ROOT_POSIX,
        canonical_files: canonical.size,
        skills: skills.length,
        host_roots: platformTargets.length,
        adapters,
        deduplicated: true
      },
      null,
      2
    )
  );
}

async function verifyRoot(platform, expected) {
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
    return;
  }
  const recorded = manifest.files ?? {};
  for (const [rel, expectedHash] of expected) {
    if (recorded[rel] !== expectedHash)
      failures.push(`${platform.id}: manifest differs from expected layout: ${rel}`);
    try {
      const actualHash = sha256(await readFile(join(root, ...rel.split("/"))));
      if (actualHash !== expectedHash)
        failures.push(`${platform.id}: file differs from expected layout: ${rel}`);
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
    if (!expected.has(rel))
      failures.push(`${platform.id}: unknown or un-retired managed file: ${rel}`);
  }
}

/** Every adapter pointer must resolve to a real canonical file inside the repository root. */
async function verifyPointerTargets(platform) {
  const root = join(projectRoot, ...platform.path.split("/"));
  for (const skill of skills) {
    const adapter = join(root, skill, "SKILL.md");
    let text;
    try {
      text = await readFile(adapter, "utf8");
    } catch (error) {
      failures.push(`${platform.id}: unreadable adapter ${skill}/SKILL.md (${error.message})`);
      continue;
    }
    const pointer = adapterPointer(platform.path, skill);
    if (!text.includes(pointer)) {
      failures.push(`${platform.id}: adapter ${skill} does not name its canonical pointer`);
      continue;
    }
    const resolved = join(root, skill, ...pointer.split("/"));
    const inside = relative(projectRoot, resolved);
    if (inside.startsWith("..") || inside.includes(`..${sep}`)) {
      failures.push(`${platform.id}: adapter ${skill} points outside the managed root`);
      continue;
    }
    try {
      await readFile(resolved);
    } catch (error) {
      failures.push(`${platform.id}: adapter ${skill} points at a missing file (${error.message})`);
    }
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

async function collectCanonicalFiles() {
  const files = new Map();
  for (const path of await walk(canonicalRoot)) {
    const rel = relative(canonicalRoot, path).split(sep).join("/");
    if (rel.startsWith("commands/")) continue;
    files.set(`fullstack-forge/${rel}`, await readFile(path));
  }
  for (const slug of expectedSlugs) {
    files.set(
      `forge-${slug}/SKILL.md`,
      await readFile(join(commandRoot, `forge-${slug}`, "SKILL.md"))
    );
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

async function walk(root) {
  const files = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
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
  return first === "fullstack-forge" || first === "forge" || first.startsWith("forge-");
}
