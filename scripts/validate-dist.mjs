import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { validateArchiveBytes } from "./lib/archive-validation.mjs";
import { assertDistributionInventory } from "./lib/dist-safety.mjs";
import { assertNoSymlinkPath, assertRegularFile } from "./lib/fs-safety.mjs";
import { CANONICAL_ROOT_POSIX, readAdapterMarker } from "./lib/managed-layout.mjs";
import { GENERATED_BUILD_RUNTIME_PATHS } from "./lib/package-policy.mjs";
import { loadPackageOwnership } from "./lib/package-ownership.mjs";
import {
  loadTrustedNpmInputHashes,
  releaseArtifactNames,
  validateNpmPackageArchive,
  validateSpdxSbom
} from "./lib/release-bundle.mjs";
import { platformTargets, projectRoot } from "./project.mjs";

const distRoot = join(projectRoot, "dist");
await assertNoSymlinkPath(projectRoot, distRoot);
const version = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).version;
const expectedArchives = [
  "all",
  "antigravity",
  "claude",
  "codex",
  "cursor",
  "gemini",
  "generic",
  "github",
  "windsurf"
].map((platform) => `fullstack-forge-${platform}-v${version}.zip`);
const releaseNames = releaseArtifactNames(version);
const expectedPayloads = [...expectedArchives, releaseNames.package, releaseNames.sbom];
const expectedDistNames = new Set([
  ...expectedPayloads,
  "SHA256SUMS.txt",
  "manifest.json",
  ".fullstack-forge-dist-manifest.json"
]);
await assertDistributionInventory(projectRoot, distRoot, expectedDistNames);
const requiredEntries = [
  "README.md",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "docs/ANALYZER_SUPPORT.md",
  "docs/COVERAGE.md",
  "docs/GETTING_STARTED.md",
  "docs/REPOSITORY_INVENTORY.md",
  "docs/REPORT_SCHEMA.md",
  "docs/RELEASE_CHANNEL.md",
  "docs/TRACEABILITY.md",
  "docs/TRACEABILITY_MATRIX.md",
  "research/SOURCES.md",
  "examples/quickstart-demo/README.md",
  `docs/RELEASE_NOTES_v${version}.md`,
  `docs/RELEASE_VERIFICATION_v${version}.md`
];
const requiredManagedEntries = [
  `${CANONICAL_ROOT_POSIX}/fullstack-forge/SKILL.md`,
  ".fullstack-forge/manifests/module-composition.json",
  ".fullstack-forge/manifests/upstream-registry.json",
  ".fullstack-forge/manifests/upstream-transforms.json",
  ".fullstack-forge/runtime/cli/src/composition-entry.js"
];
await assertRegularFile(join(distRoot, "manifest.json"), "distribution manifest");
await assertRegularFile(join(distRoot, "SHA256SUMS.txt"), "checksum file");
const manifest = JSON.parse(await readFile(join(distRoot, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 2 || manifest.version !== version || manifest.deterministic !== true)
  throw new Error("Distribution manifest metadata is invalid");
const manifestNames = Object.keys(manifest.archives ?? {}).sort();
if (JSON.stringify(manifestNames) !== JSON.stringify([...expectedArchives].sort()))
  throw new Error("Distribution manifest archive set is incomplete or contains extras");
const artifactNames = Object.keys(manifest.artifacts ?? {}).sort();
if (JSON.stringify(artifactNames) !== JSON.stringify([...expectedPayloads].sort()))
  throw new Error("Distribution manifest artifact set is incomplete or contains extras");

const checksumText = await readFile(join(distRoot, "SHA256SUMS.txt"), "utf8");
const checksums = new Map();
for (const line of checksumText.trim().split(/\r?\n/u)) {
  const match = /^([a-f0-9]{64}) {2}([^/\\]+)$/u.exec(line);
  if (match === null) throw new Error(`Invalid SHA256SUMS line: ${line}`);
  if (checksums.has(match[2])) throw new Error(`Duplicate SHA256SUMS entry: ${match[2]}`);
  checksums.set(match[2], match[1]);
}
if (JSON.stringify([...checksums.keys()].sort()) !== JSON.stringify([...expectedPayloads].sort()))
  throw new Error("SHA256SUMS artifact set is incomplete or contains extras");

/**
 * Resolves every host adapter inside one archive the way an agent on that host would.
 *
 * A release archive is extracted straight into a project, so the archive namespace *is* the
 * installation layout. Asserting that some `SKILL.md` exists is not enough: each adapter is only a
 * pointer, so the archive must also carry the canonical file that pointer names, resolved from the
 * adapter's own directory. Returns the number of adapters proved resolvable.
 */
function assertArchiveResolves(archiveName, entries) {
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  let resolved = 0;
  for (const [name, data] of byName) {
    const hostRoot = platformTargets.find((target) => name.startsWith(`${target.path}/`));
    if (hostRoot === undefined || !name.endsWith("/SKILL.md")) continue;
    const marker = readAdapterMarker(data.toString("utf8"));
    if (marker === undefined)
      throw new Error(
        `${archiveName}:${name} is not a managed adapter and names no canonical file`
      );
    const target = posix.normalize(posix.join(posix.dirname(name), marker.canonical));
    if (target.startsWith("..") || !target.startsWith(`${CANONICAL_ROOT_POSIX}/`))
      throw new Error(`${archiveName}:${name} points outside the canonical root: ${target}`);
    if (!byName.has(target))
      throw new Error(
        `${archiveName}:${name} points at ${target}, which the archive does not contain; extracting this archive would produce a damaged installation`
      );
    resolved += 1;
  }
  if (resolved === 0) throw new Error(`${archiveName} contains no resolvable host adapter`);
  return resolved;
}

function assertCompleteForgeRuntime(archiveName, entries) {
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  for (const required of requiredManagedEntries)
    if (!byName.has(required)) throw new Error(`${archiveName} is missing ${required}`);

  const composition = JSON.parse(
    byName.get(".fullstack-forge/manifests/module-composition.json").toString("utf8")
  );
  const registry = JSON.parse(
    byName.get(".fullstack-forge/manifests/upstream-registry.json").toString("utf8")
  );
  for (const module of composition.modules ?? []) {
    const contract = `${CANONICAL_ROOT_POSIX}/fullstack-forge/${module.forgeContract}`;
    if (!byName.has(contract))
      throw new Error(`${archiveName}:${module.module} is missing Forge contract ${contract}`);
    for (const source of module.resolvedSources ?? [])
      if (!byName.has(source.runtimePath))
        throw new Error(
          `${archiveName}:${module.module} resolves ${source.provider}/${source.skill} to missing ${source.runtimePath}`
        );
  }

  const upstreamSkills = [...byName.keys()].filter(
    (name) => name.startsWith(".fullstack-forge/upstream/") && name.endsWith("/SKILL.md")
  );
  if (upstreamSkills.length > 0)
    throw new Error(`${archiveName} exposes discoverable upstream skills: ${upstreamSkills[0]}`);

  const notices = byName.get("THIRD_PARTY_NOTICES.md").toString("utf8");
  for (const provider of registry.providers ?? []) {
    if (!notices.includes(provider.displayName) || !notices.includes(provider.repository))
      throw new Error(`${archiveName} notices do not identify shipped provider ${provider.id}`);
    for (const attribution of ["UPSTREAM-LICENSE", "UPSTREAM-NOTICE", "UPSTREAM-SOURCE.md"]) {
      const path = `${provider.runtimeRoot}/${attribution}`;
      if (!byName.has(path))
        throw new Error(`${archiveName} is missing ${provider.id} attribution ${path}`);
    }
  }
  return { composition, registry };
}

async function assertCleanRoomExtraction(archiveName, entries, composition) {
  const extractionRoot = await mkdtemp(join(tmpdir(), "fullstack-forge-archive-"));
  try {
    for (const entry of entries) {
      const target = join(extractionRoot, ...entry.name.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, entry.data);
    }
    for (const required of requiredManagedEntries)
      await assertRegularFile(
        join(extractionRoot, ...required.split("/")),
        `${archiveName} extracted managed file`
      );
    for (const module of composition.modules ?? []) {
      await assertRegularFile(
        join(
          extractionRoot,
          CANONICAL_ROOT_POSIX,
          "fullstack-forge",
          ...module.forgeContract.split("/")
        ),
        `${archiveName} extracted Forge contract`
      );
      for (const source of module.resolvedSources ?? [])
        await assertRegularFile(
          join(extractionRoot, ...source.runtimePath.split("/")),
          `${archiveName} extracted upstream runtime source`
        );
    }
    const fixtureRoot = join(extractionRoot, "clean-room-project");
    await mkdir(fixtureRoot);
    await writeFile(
      join(fixtureRoot, "package.json"),
      `${JSON.stringify({
        name: "archive-composition-fixture",
        private: true,
        dependencies: { react: "19.0.0", "@sentry/react": "10.0.0" }
      })}\n`,
      "utf8"
    );
    const execution = await run(
      process.execPath,
      [
        join(extractionRoot, ".fullstack-forge", "runtime", "cli", "src", "composition-entry.js"),
        "observability",
        "compose",
        "--request",
        "sentry-react",
        "--root",
        fixtureRoot,
        "--json"
      ],
      fixtureRoot
    );
    if (execution.exitCode !== 0)
      throw new Error(
        `${archiveName} composition runtime failed clean-room execution: ${execution.stderr}`
      );
    const resolved = JSON.parse(execution.stdout);
    const result = resolved.compositions?.[0];
    if (
      !Array.isArray(result?.selected) ||
      result.selected[0]?.tier !== "forge-contract" ||
      !result.selected.some((source) => source.skill === "sentry-react-sdk") ||
      !Array.isArray(result.missing) ||
      result.missing.length !== 0
    )
      throw new Error(`${archiveName} composition runtime returned an incomplete resolution`);
  } finally {
    await rm(extractionRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function run(command, args, cwd) {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolvePromise({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}

let totalEntries = 0;
let totalResolvedAdapters = 0;
for (const name of expectedPayloads) {
  await assertRegularFile(join(distRoot, name), "distribution artifact");
  const bytes = await readFile(join(distRoot, name));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (checksums.get(name) !== hash || manifest.artifacts[name]?.sha256 !== hash)
    throw new Error(`Checksum mismatch for ${name}`);
  if (manifest.artifacts[name]?.bytes !== bytes.length)
    throw new Error(`Byte count mismatch for ${name}`);
}

const packageBytes = await readFile(join(distRoot, releaseNames.package));
if (manifest.npmPackage?.name !== releaseNames.package)
  throw new Error("Distribution manifest does not identify the exact npm package artifact");
if (manifest.sbom?.name !== releaseNames.sbom || manifest.sbom?.format !== "SPDX-2.3")
  throw new Error("Distribution manifest does not identify the SPDX release SBOM");
const [packageLock, packageOwnership, registry, sbomBytes] = await Promise.all([
  readFile(join(projectRoot, "package-lock.json"), "utf8").then(JSON.parse),
  loadPackageOwnership(projectRoot),
  readFile(
    join(projectRoot, ".fullstack-forge", "manifests", "upstream-registry.json"),
    "utf8"
  ).then(JSON.parse),
  readFile(join(distRoot, releaseNames.sbom))
]);
const trustedPackageHashes = await loadTrustedNpmInputHashes(
  projectRoot,
  version,
  packageOwnership
);
const npmArchive = validateNpmPackageArchive(
  packageBytes,
  version,
  packageOwnership.paths,
  GENERATED_BUILD_RUNTIME_PATHS,
  trustedPackageHashes
);
if (
  manifest.npmPackage?.entryCount !== npmArchive.entryCount ||
  manifest.npmPackage?.unpackedBytes !== npmArchive.unpackedBytes ||
  manifest.npmPackage?.inventorySha256 !== npmArchive.inventorySha256
)
  throw new Error("Distribution manifest npm inventory does not match the package archive bytes");
validateSpdxSbom(sbomBytes, {
  version,
  packageBytes,
  packageLock,
  registry,
  sourceRevision: manifest.source?.revision,
  created: manifest.source?.created
});

for (const name of expectedArchives) {
  await assertRegularFile(join(distRoot, name), "distribution archive");
  const bytes = await readFile(join(distRoot, name));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (manifest.archives[name]?.sha256 !== hash) throw new Error(`Checksum mismatch for ${name}`);
  if (manifest.archives[name]?.bytes !== bytes.length)
    throw new Error(`Byte count mismatch for ${name}`);
  const entries = validateArchiveBytes(bytes, name, version);
  totalEntries += entries.length;
  const names = new Set(entries.map((entry) => entry.name));
  for (const required of requiredEntries)
    if (!names.has(required)) throw new Error(`${name} is missing ${required}`);
  if (![...names].some((entry) => entry.endsWith("/fullstack-forge/SKILL.md")))
    throw new Error(`${name} contains no Fullstack Forge master skill`);
  const completeRuntime = assertCompleteForgeRuntime(name, entries);
  totalResolvedAdapters += assertArchiveResolves(name, entries);
  await assertCleanRoomExtraction(name, entries, completeRuntime.composition);
}

console.log(
  JSON.stringify(
    {
      valid: true,
      version,
      archives: expectedArchives.length,
      artifacts: expectedPayloads.length,
      entries: totalEntries,
      resolved_adapters: totalResolvedAdapters
    },
    null,
    2
  )
);
