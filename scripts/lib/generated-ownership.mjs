import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { assertNoSymlinkPath, assertRegularFile, assertSafeRelativePath } from "./fs-safety.mjs";

export const GENERATED_OWNERSHIP_FILENAME = ".fullstack-forge-generated.json";

// The TypeScript build emits one JavaScript module and one declaration module for each source
// module.  Keep this list explicit: a broad `build/cli/src/*.js` package rule would allow a
// stray generated file (or a developer's local payload) to cross the npm release boundary.  A
// newly-added CLI module must therefore be deliberately reviewed here before it can ship.
export const GENERATED_BUILD_RUNTIME_MODULES = Object.freeze([
  "agent-detection",
  "agent-findings",
  "analyzers",
  "application-inspection",
  "audit-orchestration",
  "authorization-policy",
  "automatic-activation",
  "build-applicability",
  "build-gates",
  "build-migration-journal",
  "build-migration",
  "build-producers",
  "build-runtime",
  "build-state",
  "build",
  "cli",
  "composition-entry",
  "composition-runtime",
  "composition",
  "constants",
  "dataflow",
  "dependency-expansion",
  "destination-policy",
  "discovery-evidence",
  "discovery",
  "evidence-envelope",
  "finding",
  "fixes",
  "frontend-routing",
  "gates",
  "guard-resolution",
  "index",
  "inspectors",
  "installer",
  "inventory-evidence",
  "ledger",
  "legacy-install-hashes",
  "managed-layout",
  "module-resolution",
  "net-policy",
  "offline-policy",
  "project-command-execution",
  "redaction",
  "rendered-ui",
  "report-output",
  "report",
  "repository-inventory",
  "scope",
  "simple-cli",
  "support",
  "tools",
  "transactions",
  "types",
  "update-check",
  "uploads",
  "upstream-detector",
  "utils",
  "verification"
]);

/**
 * Return the exact relative paths emitted by the TypeScript CLI build.
 *
 * A fresh Set is returned to keep callers from mutating the module-level allowlist.
 */
export function generatedBuildRuntimePaths() {
  return new Set(
    GENERATED_BUILD_RUNTIME_MODULES.flatMap((module) => [
      `build/cli/src/${module}.js`,
      `build/cli/src/${module}.d.ts`
    ])
  );
}

/**
 * Verify that the compiled CLI tree contains exactly the reviewed, unlinked runtime files.
 * This is intentionally separate from the synchronous package-path policy so npm packing can
 * fail before it reads a hard-linked or symlinked build output file.
 */
export async function assertGeneratedBuildRuntime(projectRoot) {
  const root = join(projectRoot, "build", "cli", "src");
  await assertNoSymlinkPath(projectRoot, root);
  const expected = generatedBuildRuntimePaths();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Generated CLI runtime is missing: ${root}`, { cause: error });
  }
  for (const entry of entries) {
    const relativePath = entry.name;
    const path = `build/cli/src/${relativePath}`;
    if (!expected.has(path) || !entry.isFile() || entry.isSymbolicLink())
      throw new Error(`Unexpected generated CLI runtime input: ${safeDisplayPath(path)}`);
  }
  for (const path of expected) {
    const absolute = join(projectRoot, ...path.split("/"));
    await assertNoSymlinkPath(projectRoot, absolute);
    try {
      await assertUnlinkedRegularFile(absolute, "generated CLI runtime input");
    } catch (error) {
      if (error?.code === "ENOENT")
        throw new Error(`Generated CLI runtime is missing: ${path}`, { cause: error });
      throw error;
    }
  }
}

export function serializeGeneratedOwnership(platform, files) {
  if (typeof platform !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(platform))
    throw new Error(`Invalid generated ownership platform: ${platform}`);
  const normalized = Object.fromEntries(
    [...files.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, hash]) => {
        assertOwnershipRecord(path, hash);
        return [path, hash];
      })
  );
  return `${JSON.stringify(
    { schemaVersion: 1, generator: "fullstack-forge", platform, files: normalized },
    null,
    2
  )}\n`;
}

export function parseGeneratedOwnership(bytes, expectedPlatform, label = "ownership manifest") {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (
    parsed?.schemaVersion !== 1 ||
    parsed?.generator !== "fullstack-forge" ||
    parsed?.platform !== expectedPlatform ||
    !isRecord(parsed?.files)
  )
    throw new Error(`${label} has unsupported ownership metadata`);
  const files = new Map();
  for (const [path, hash] of Object.entries(parsed.files)) {
    assertOwnershipRecord(path, hash);
    if (files.has(path)) throw new Error(`${label} contains duplicate path ${path}`);
    files.set(path, hash);
  }
  if (files.size === 0) throw new Error(`${label} contains no owned files`);
  const canonical = serializeGeneratedOwnership(expectedPlatform, files);
  const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes;
  if (text !== canonical) throw new Error(`${label} is not in deterministic canonical form`);
  return files;
}

export async function writeGeneratedOwnership(root, platform, relativePaths) {
  await assertNoSymlinkPath(root, root);
  const paths =
    relativePaths === undefined
      ? (await walk(root))
          .map((path) => relative(root, path).split(sep).join("/"))
          .filter((path) => path !== GENERATED_OWNERSHIP_FILENAME)
      : [...relativePaths];
  const files = new Map();
  for (const path of [...new Set(paths)].sort()) {
    assertSafeRelativePath(path, "generated ownership path");
    if (path === GENERATED_OWNERSHIP_FILENAME)
      throw new Error("Generated ownership manifest cannot own itself");
    const absolute = join(root, ...path.split("/"));
    await assertNoSymlinkPath(root, absolute);
    await assertUnlinkedRegularFile(absolute, "generated owned file");
    files.set(path, sha256(await readFile(absolute)));
  }
  if (files.size === 0) throw new Error(`Refusing to write empty generated ownership for ${root}`);
  const marker = join(root, GENERATED_OWNERSHIP_FILENAME);
  await assertNoSymlinkPath(root, marker);
  await assertAbsentOrUnlinkedFile(marker, "generated ownership manifest");
  await writeFile(marker, serializeGeneratedOwnership(platform, files), "utf8");
  return files;
}

function assertOwnershipRecord(path, hash) {
  assertSafeRelativePath(path, "generated ownership path");
  if (
    path.includes("\\") ||
    path === GENERATED_OWNERSHIP_FILENAME ||
    typeof hash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(hash)
  )
    throw new Error(`Invalid generated ownership record: ${path}`);
}

async function walk(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in generated ownership root: ${path}`);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else if (entry.isFile()) {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error(`Non-regular generated ownership input: ${path}`);
      if (info.nlink !== 1)
        throw new Error(
          `Hard-linked generated ownership input is forbidden (nlink=${info.nlink}): ${path}`
        );
      output.push(path);
    } else throw new Error(`Unsupported generated ownership input: ${path}`);
  }
  return output;
}

async function assertUnlinkedRegularFile(path, label) {
  const info = await assertRegularFile(path, label);
  if (info.nlink !== 1)
    throw new Error(`Hard-linked ${label} is forbidden (nlink=${info.nlink}): ${path}`);
  return info;
}

async function assertAbsentOrUnlinkedFile(path, label) {
  try {
    await assertUnlinkedRegularFile(path, label);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeDisplayPath(path) {
  return [...path]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? "?" : character;
    })
    .join("");
}
