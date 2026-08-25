import { execFile } from "node:child_process";
import { Buffer, isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
import { assertNoSymlinkPath } from "./fs-safety.mjs";
import { assertGeneratedBuildRuntime } from "./generated-ownership.mjs";
import {
  assertPublishableNpmPath,
  GENERATED_BUILD_RUNTIME_PATHS,
  NPM_ONLY_PACKAGE_PATHS,
  packageCommonPaths
} from "./package-policy.mjs";
import { loadPackageOwnership, validatePackagedOwnership } from "./package-ownership.mjs";
import { crc32 } from "./zip.mjs";

const runFile = promisify(execFile);
const PACKAGE_NAME = "fullstack-forge-skill";
const RELEASE_REPOSITORY = "is-bo/fullstack-forge-skill";
const ROOT_SPDX_ID = "SPDXRef-Package-fullstack-forge-skill";
const PACK_TEMP_PREFIX = "fullstack-forge-release-pack-";
const TAR_BLOCK_BYTES = 512;
const MAX_NPM_PACKAGE_BYTES = 128 * 1024 * 1024;
const MAX_NPM_UNPACKED_BYTES = 256 * 1024 * 1024;
const MAX_NPM_PACKAGE_ENTRIES = 20_000;
const REQUIRED_PACKED_PATHS = Object.freeze([
  ".fullstack-forge/skills/fullstack-forge/SKILL.md",
  "LICENSE",
  "build/cli/src/index.js",
  "package.json"
]);
export function releaseArtifactNames(version) {
  assertStableVersion(version);
  return {
    package: `${PACKAGE_NAME}-v${version}.tgz`,
    sbom: `${PACKAGE_NAME}-v${version}.spdx.json`
  };
}

export async function createReleaseBundle({ projectRoot, version, requireCleanInputs = false }) {
  if (requireCleanInputs) await assertCleanReleaseInputs(projectRoot);
  const [packageCandidate, sourceIdentity] = await Promise.all([
    packExactNpmArtifact(projectRoot, version),
    readSourceIdentity(projectRoot)
  ]);
  if (requireCleanInputs) await assertCleanReleaseInputs(projectRoot);
  const [packageLock, registry] = await Promise.all([
    readJson(join(projectRoot, "package-lock.json"), "package-lock.json"),
    readJson(
      join(projectRoot, ".fullstack-forge", "manifests", "upstream-registry.json"),
      "upstream runtime registry"
    )
  ]);
  const names = releaseArtifactNames(version);
  const sbomBytes = createSpdxSbom({
    version,
    packageBytes: packageCandidate.bytes,
    packageLock,
    registry,
    sourceRevision: sourceIdentity.revision,
    created: sourceIdentity.created
  });
  return {
    names,
    packageBytes: packageCandidate.bytes,
    sbomBytes,
    packageReport: packageCandidate.report,
    sourceIdentity
  };
}

/**
 * Assert that the source tree used to create a release has no tracked or untracked changes.
 *
 * Local packaging intentionally remains permissive; release verification opts in with
 * `requireCleanInputs` so a developer can still produce a diagnostic bundle while CI fails closed
 * on a package assembled from dirty or untracked inputs.
 */
export async function assertCleanReleaseInputs(projectRoot) {
  let result;
  try {
    result = await runFile("git", ["status", "--porcelain=v1", "--untracked-files=all", "-z"], {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    throw new Error("Could not prove a clean source tree for release packaging", { cause: error });
  }
  const dirty = result.stdout
    .split("\0")
    .filter((record) => record.length > 0)
    .map((record) => {
      const status = record.slice(0, 2).trim() || "??";
      const path = safeDisplayPath(record.slice(3).replace(/^"|"$/gu, ""));
      return `${status} ${path || "<unknown>"}`;
    });
  if (dirty.length > 0)
    throw new Error(
      `Release package inputs are dirty or untracked (${dirty.length} status record${
        dirty.length === 1 ? "" : "s"
      }): ${dirty.slice(0, 12).join(", ")}`
    );
  return { clean: true };
}

export function createSpdxSbom({
  version,
  packageBytes,
  packageLock,
  registry,
  sourceRevision,
  created
}) {
  assertStableVersion(version);
  if (!Buffer.isBuffer(packageBytes) || packageBytes.length === 0)
    throw new Error("SPDX generation requires the exact non-empty npm package bytes");
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision))
    throw new Error("SPDX generation requires a full source revision");
  if (!isCanonicalTimestamp(created))
    throw new Error("SPDX generation requires a canonical UTC creation timestamp");
  const runtimePackages = runtimeNpmPackages(packageLock, version);
  const providers = vendoredProviders(registry);
  const packageHash = sha256(packageBytes);
  const packageAsset = releaseArtifactNames(version).package;

  const rootPackage = {
    name: PACKAGE_NAME,
    SPDXID: ROOT_SPDX_ID,
    versionInfo: version,
    downloadLocation: `https://github.com/${RELEASE_REPOSITORY}/releases/download/v${version}/${packageAsset}`,
    filesAnalyzed: false,
    packageFileName: packageAsset,
    checksums: [{ algorithm: "SHA256", checksumValue: packageHash }],
    licenseConcluded: "Apache-2.0",
    licenseDeclared: "Apache-2.0",
    copyrightText: "Copyright 2026 is-bo",
    primaryPackagePurpose: "APPLICATION",
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: `pkg:github/${RELEASE_REPOSITORY}@v${version}`
      }
    ]
  };
  const npmPackages = runtimePackages.map((dependency) => ({
    name: dependency.name,
    SPDXID: dependency.spdxId,
    versionInfo: dependency.version,
    downloadLocation: dependency.resolved,
    filesAnalyzed: false,
    checksums: [dependency.checksum],
    licenseConcluded: dependency.license,
    licenseDeclared: dependency.license,
    copyrightText: "NOASSERTION",
    primaryPackagePurpose: "LIBRARY",
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: npmPurl(dependency.name, dependency.version)
      }
    ]
  }));
  const providerPackages = providers.map((provider) => ({
    name: provider.displayName,
    SPDXID: provider.spdxId,
    versionInfo: provider.upstreamTag ?? provider.upstreamCommit,
    // The shipped component is a reviewed and transformed runtime tree, not the upstream archive.
    // Claiming the upstream Git URL here would make the runtime-tree checksum unverifiable against
    // the declared download. Preserve upstream identity in sourceInfo and the external reference.
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    checksums: [{ algorithm: "SHA256", checksumValue: provider.runtimeChecksum }],
    licenseConcluded: provider.license,
    licenseDeclared: provider.license,
    copyrightText: provider.copyright ?? "NOASSERTION",
    primaryPackagePurpose: "SOURCE",
    sourceInfo: `Reviewed and transformed from https://github.com/${provider.repository}/tree/${provider.upstreamCommit}; the SHA256 identifies the packaged runtime content tree at .fullstack-forge/upstream/${provider.id}, not an upstream download archive.`,
    externalRefs: [
      {
        referenceCategory: "PACKAGE-MANAGER",
        referenceType: "purl",
        referenceLocator: `pkg:github/${provider.repository}@${provider.upstreamCommit}`
      }
    ]
  }));
  const relationships = [
    ...runtimePackages.map((dependency) => ({
      spdxElementId: ROOT_SPDX_ID,
      relationshipType: "DEPENDS_ON",
      relatedSpdxElement: dependency.spdxId
    })),
    ...providers.map((provider) => ({
      spdxElementId: ROOT_SPDX_ID,
      relationshipType: "CONTAINS",
      relatedSpdxElement: provider.spdxId
    }))
  ].sort((left, right) =>
    `${left.relationshipType}:${left.relatedSpdxElement}`.localeCompare(
      `${right.relationshipType}:${right.relatedSpdxElement}`
    )
  );
  const document = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${PACKAGE_NAME}-v${version}`,
    documentNamespace: `https://github.com/${RELEASE_REPOSITORY}/sbom/v${version}/${packageHash}`,
    creationInfo: {
      created,
      creators: ["Organization: Fullstack Forge", "Tool: fullstack-forge-release-bundle"]
    },
    documentDescribes: [ROOT_SPDX_ID],
    packages: [rootPackage, ...npmPackages, ...providerPackages],
    relationships,
    annotations: [
      {
        annotationDate: created,
        annotationType: "OTHER",
        annotator: "Tool: fullstack-forge-release-bundle",
        comment: `Source revision ${sourceRevision}; runtime npm dependencies and vendored upstream providers are inventory-bound.`
      }
    ]
  };
  return Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8");
}

export function validateSpdxSbom(bytes, input) {
  if (!Buffer.isBuffer(bytes)) throw new Error("SBOM validation requires bytes");
  let document;
  try {
    document = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Release SBOM is not valid JSON");
  }
  const root = Array.isArray(document?.packages)
    ? document.packages.find((entry) => entry?.SPDXID === ROOT_SPDX_ID)
    : undefined;
  const checksum = Array.isArray(root?.checksums)
    ? root.checksums.find((entry) => entry?.algorithm === "SHA256")?.checksumValue
    : undefined;
  if (checksum !== sha256(input.packageBytes))
    throw new Error("Release SBOM package checksum does not match the exact npm package artifact");
  const expected = createSpdxSbom(input);
  if (!bytes.equals(expected))
    throw new Error("Release SBOM differs from the deterministic component inventory");
  return {
    format: "SPDX-2.3",
    packages: document.packages.length,
    relationships: document.relationships.length
  };
}

/**
 * Validate the npm package from its gzip and tar bytes, independently of `npm pack --json`.
 *
 * npm's report is useful corroborating evidence, but it is emitted by the same process that writes
 * the archive. This parser deliberately supports only the regular-file USTAR subset npm emits for
 * this package. Links, devices, extensions, duplicate paths, concatenated gzip members, and
 * non-zero trailing data all fail closed instead of being normalized by an extraction library.
 */
export function validateNpmPackageArchive(
  bytes,
  version,
  ownedPaths = new Set(),
  requiredRuntimePaths = undefined,
  expectedHashes = undefined
) {
  assertStableVersion(version);
  if (!(ownedPaths instanceof Set))
    throw new Error("npm package validation requires a trusted owned-path set");
  const runtimePaths = normalizeRuntimePaths(requiredRuntimePaths);
  const strictInventory = requiredRuntimePaths !== undefined;
  const tarBytes = inflateSingleGzipMember(bytes);
  const entries = readRegularNpmTarEntries(tarBytes);
  const byName = new Map();
  for (const entry of entries) {
    assertPublishableNpmPath(entry.name, version, ownedPaths);
    if (byName.has(entry.name))
      throw new Error(`npm package tar contains duplicate path ${entry.name}`);
    byName.set(entry.name, entry);
  }

  for (const required of REQUIRED_PACKED_PATHS)
    if (!byName.has(required)) throw new Error(`npm package artifact is missing ${required}`);
  for (const required of ownedPaths)
    if (!byName.has(required))
      throw new Error(`npm package artifact is missing generated owned path ${required}`);
  for (const required of runtimePaths)
    if (!byName.has(required))
      throw new Error(`npm package artifact is missing generated runtime path ${required}`);

  if (strictInventory) {
    const expectedPaths = expectedNpmPackagePaths(version, ownedPaths, runtimePaths);
    for (const path of expectedPaths)
      if (!byName.has(path))
        throw new Error(`npm package artifact is missing expected path ${path}`);
    for (const path of byName.keys())
      if (!expectedPaths.has(path))
        throw new Error(`npm package artifact contains unexpected regular file ${path}`);
    validatePackagedOwnership(
      entries.map(({ name, data }) => ({ name, data })),
      "npm package artifact"
    );
  }

  if (expectedHashes !== undefined) {
    if (!(expectedHashes instanceof Map))
      throw new Error("npm package validation requires trusted hashes in a Map");
    for (const [path, expectedHash] of expectedHashes) {
      if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/u.test(expectedHash))
        throw new Error(`Trusted npm package hash is invalid for ${path}`);
      const actual = byName.get(path);
      if (actual === undefined)
        throw new Error(`npm package artifact is missing hash-bound path ${path}`);
      if (actual.sha256 !== expectedHash)
        throw new Error(`npm package artifact has modified bytes for ${path}`);
    }
  }

  const files = entries
    .map(({ name: path, size, mode, sha256: hash }) => ({ path, size, mode, sha256: hash }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const unpackedBytes = files.reduce((total, file) => total + file.size, 0);
  return {
    entryCount: files.length,
    unpackedBytes,
    inventorySha256: sha256(Buffer.from(JSON.stringify(files), "utf8")),
    files
  };
}

export function validateNpmPackReport(
  report,
  version,
  bytes,
  ownedPaths = new Set(),
  requiredRuntimePaths = undefined,
  expectedHashes = undefined
) {
  assertStableVersion(version);
  if (!Array.isArray(report) || report.length !== 1 || !isRecord(report[0]))
    throw new Error("npm pack did not return one package report");
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw new Error("npm pack did not produce a non-empty package artifact");
  const entry = report[0];
  if (
    entry.name !== PACKAGE_NAME ||
    entry.version !== version ||
    entry.id !== `${PACKAGE_NAME}@${version}` ||
    entry.filename !== `${PACKAGE_NAME}-${version}.tgz`
  )
    throw new Error("npm pack report identity does not match the release package");
  if (!Number.isSafeInteger(entry.size) || entry.size !== bytes.length)
    throw new Error("npm pack report byte count does not match the package artifact");
  const archive = validateNpmPackageArchive(
    bytes,
    version,
    ownedPaths,
    requiredRuntimePaths,
    expectedHashes
  );
  if (!Number.isSafeInteger(entry.unpackedSize) || entry.unpackedSize !== archive.unpackedBytes)
    throw new Error("npm pack report unpacked byte count does not match the package archive");
  if (!Number.isSafeInteger(entry.entryCount) || entry.entryCount !== archive.entryCount)
    throw new Error("npm pack report entry count does not match the package archive");
  if (!Array.isArray(entry.files) || entry.files.length !== entry.entryCount)
    throw new Error("npm pack report file inventory is incomplete");
  const actualFiles = new Map(archive.files.map((file) => [file.path, file]));
  const reportedPaths = new Set();
  for (const file of entry.files) {
    if (
      !isRecord(file) ||
      typeof file.path !== "string" ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      !Number.isSafeInteger(file.mode) ||
      file.mode < 0 ||
      file.mode > 0o777
    )
      throw new Error("npm pack report contains an invalid file record");
    assertPublishableNpmPath(file.path, version, ownedPaths);
    if (reportedPaths.has(file.path))
      throw new Error("npm pack report contains duplicate package paths");
    reportedPaths.add(file.path);
    const actual = actualFiles.get(file.path);
    if (actual === undefined)
      throw new Error(`npm pack report names file absent from package archive: ${file.path}`);
    if (actual.size !== file.size)
      throw new Error(`npm pack report size differs from package archive: ${file.path}`);
    if (actual.mode !== file.mode)
      throw new Error(`npm pack report mode differs from package archive: ${file.path}`);
  }
  for (const path of actualFiles.keys())
    if (!reportedPaths.has(path))
      throw new Error(`npm package archive contains file absent from npm pack report: ${path}`);
  const expectedSha1 = createHash("sha1").update(bytes).digest("hex");
  if (entry.shasum !== expectedSha1) throw new Error("npm pack SHA-1 report does not match bytes");
  const integrity = parseSha512Integrity(entry.integrity, "npm pack integrity");
  const expectedSha512 = createHash("sha512").update(bytes).digest("hex");
  if (integrity.checksumValue !== expectedSha512)
    throw new Error("npm pack integrity does not match bytes");
  return {
    entryCount: archive.entryCount,
    unpackedBytes: archive.unpackedBytes,
    inventorySha256: archive.inventorySha256,
    npmSha1: entry.shasum,
    npmIntegrity: entry.integrity
  };
}

function inflateSingleGzipMember(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw new Error("npm package archive must be non-empty bytes");
  if (bytes.length > MAX_NPM_PACKAGE_BYTES)
    throw new Error(`npm package archive exceeds ${MAX_NPM_PACKAGE_BYTES} bytes`);
  if (bytes.length < 10) throw new Error("npm package archive has a truncated gzip header");
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b)
    throw new Error("npm package archive has invalid gzip magic");
  if (bytes[2] !== 8) throw new Error("npm package archive uses an unsupported gzip method");
  const flags = bytes[3] ?? 0;
  if ((flags & 0xe0) !== 0) throw new Error("npm package archive uses reserved gzip flags");

  let offset = 10;
  if ((flags & 0x04) !== 0) {
    if (offset + 2 > bytes.length)
      throw new Error("npm package archive has a truncated gzip extra header");
    const extraLength = bytes.readUInt16LE(offset);
    offset += 2;
    if (offset + extraLength > bytes.length)
      throw new Error("npm package archive has truncated gzip extra data");
    offset += extraLength;
  }
  if ((flags & 0x08) !== 0) offset = skipGzipHeaderString(bytes, offset, "name");
  if ((flags & 0x10) !== 0) offset = skipGzipHeaderString(bytes, offset, "comment");
  if ((flags & 0x02) !== 0) {
    if (offset + 2 > bytes.length)
      throw new Error("npm package archive has a truncated gzip header checksum");
    const expectedHeaderCrc = bytes.readUInt16LE(offset);
    if ((crc32(bytes.subarray(0, offset)) & 0xffff) !== expectedHeaderCrc)
      throw new Error("npm package archive gzip header checksum is invalid");
    offset += 2;
  }
  if (offset + 8 >= bytes.length)
    throw new Error("npm package archive has a truncated gzip payload or footer");

  let result;
  try {
    result = inflateRawSync(bytes.subarray(offset), {
      info: true,
      maxOutputLength: MAX_NPM_UNPACKED_BYTES
    });
  } catch (error) {
    throw new Error("npm package archive gzip payload is invalid or truncated", { cause: error });
  }
  const tarBytes = result?.buffer;
  const consumed = result?.engine?.bytesWritten;
  if (!Buffer.isBuffer(tarBytes) || !Number.isSafeInteger(consumed) || consumed <= 0)
    throw new Error("npm package archive gzip decompression did not prove its byte boundary");
  const footerOffset = offset + consumed;
  if (footerOffset + 8 !== bytes.length)
    throw new Error("npm package archive has trailing data or multiple gzip members");
  if (bytes.readUInt32LE(footerOffset) !== crc32(tarBytes))
    throw new Error("npm package archive gzip payload checksum is invalid");
  if (bytes.readUInt32LE(footerOffset + 4) !== tarBytes.length >>> 0)
    throw new Error("npm package archive gzip unpacked size is invalid");
  return tarBytes;
}

function skipGzipHeaderString(bytes, offset, label) {
  const end = bytes.indexOf(0, offset);
  if (end < 0) throw new Error(`npm package archive has a truncated gzip ${label}`);
  if (end - offset > 64 * 1024)
    throw new Error(`npm package archive has an oversized gzip ${label}`);
  return end + 1;
}

function readRegularNpmTarEntries(bytes) {
  if (bytes.length < TAR_BLOCK_BYTES * 2 || bytes.length % TAR_BLOCK_BYTES !== 0)
    throw new Error("npm package tar has a truncated block boundary");
  const entries = [];
  const seen = new Set();
  let offset = 0;
  let terminated = false;
  while (offset + TAR_BLOCK_BYTES <= bytes.length) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (isZeroBlock(header)) {
      const second = bytes.subarray(offset + TAR_BLOCK_BYTES, offset + TAR_BLOCK_BYTES * 2);
      if (second.length !== TAR_BLOCK_BYTES || !isZeroBlock(second))
        throw new Error("npm package tar has only one end-of-archive block");
      if (!isZeroBlock(bytes.subarray(offset)))
        throw new Error("npm package tar has non-zero trailing data");
      terminated = true;
      break;
    }
    if (entries.length >= MAX_NPM_PACKAGE_ENTRIES)
      throw new Error(`npm package tar exceeds ${MAX_NPM_PACKAGE_ENTRIES} entries`);

    assertTarChecksum(header);
    if (
      !header.subarray(257, 263).equals(Buffer.from("ustar\0", "ascii")) ||
      !header.subarray(263, 265).equals(Buffer.from("00", "ascii"))
    )
      throw new Error("npm package tar uses an unsupported non-USTAR header");
    const type = header[156] ?? 0;
    if (type !== 0 && type !== 0x30)
      throw new Error(`npm package tar contains non-regular entry type ${displayTarType(type)}`);
    const linkName = readTarText(header.subarray(157, 257), "link name");
    if (linkName !== "") throw new Error("npm package tar regular entry names a link target");
    const mode = readTarOctal(header.subarray(100, 108), "mode");
    if ((mode & ~0o777) !== 0)
      throw new Error("npm package tar regular entry uses unsafe mode bits");
    readTarOctal(header.subarray(108, 116), "uid");
    readTarOctal(header.subarray(116, 124), "gid");
    const size = readTarOctal(header.subarray(124, 136), "size");
    readTarOctal(header.subarray(136, 148), "mtime");
    if (
      readTarOctal(header.subarray(329, 337), "device major") !== 0 ||
      readTarOctal(header.subarray(337, 345), "device minor") !== 0
    )
      throw new Error("npm package tar regular entry declares a device number");
    const name = readTarText(header.subarray(0, 100), "name");
    const prefix = readTarText(header.subarray(345, 500), "prefix");
    const archivePath = prefix === "" ? name : `${prefix}/${name}`;
    if (!archivePath.startsWith("package/") || archivePath.length === "package/".length)
      throw new Error(
        `npm package tar contains path outside package/: ${safeDisplayPath(archivePath)}`
      );
    const packagePath = archivePath.slice("package/".length);
    if (seen.has(packagePath))
      throw new Error(`npm package tar contains duplicate path ${safeDisplayPath(packagePath)}`);
    seen.add(packagePath);

    const dataStart = offset + TAR_BLOCK_BYTES;
    const dataEnd = dataStart + size;
    const nextOffset = dataStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (
      !Number.isSafeInteger(dataEnd) ||
      !Number.isSafeInteger(nextOffset) ||
      dataEnd > bytes.length ||
      nextOffset > bytes.length
    )
      throw new Error(`npm package tar has truncated data for ${safeDisplayPath(packagePath)}`);
    if (!isZeroBlock(bytes.subarray(dataEnd, nextOffset)))
      throw new Error(`npm package tar has non-zero padding for ${safeDisplayPath(packagePath)}`);
    const data = bytes.subarray(dataStart, dataEnd);
    entries.push({
      name: packagePath,
      data,
      size,
      mode,
      sha256: sha256(data)
    });
    offset = nextOffset;
  }
  if (!terminated) throw new Error("npm package tar has no complete end-of-archive marker");
  return entries;
}

function assertTarChecksum(header) {
  const expected = readTarOctal(header.subarray(148, 156), "checksum");
  let actual = 0;
  for (let index = 0; index < header.length; index += 1)
    actual += index >= 148 && index < 156 ? 0x20 : (header[index] ?? 0);
  if (actual !== expected) throw new Error("npm package tar header checksum is invalid");
}

function readTarText(field, label) {
  const zero = field.indexOf(0);
  const content = zero < 0 ? field : field.subarray(0, zero);
  if (zero >= 0 && !isZeroBlock(field.subarray(zero)))
    throw new Error(`npm package tar ${label} has non-zero bytes after its terminator`);
  if (!isUtf8(content)) throw new Error(`npm package tar ${label} is not UTF-8`);
  const value = content.toString("utf8");
  if ([...value].some((character) => character.charCodeAt(0) < 0x20 || character === "\u007f"))
    throw new Error(`npm package tar ${label} contains control characters`);
  return value;
}

function readTarOctal(field, label) {
  if ((field[0] ?? 0) >= 0x80)
    throw new Error(`npm package tar ${label} uses unsupported binary encoding`);
  const value = field.toString("ascii").replace(/^[\0 ]+|[\0 ]+$/gu, "");
  if (value === "") return 0;
  if (!/^[0-7]+$/u.test(value)) throw new Error(`npm package tar ${label} is not octal`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`npm package tar ${label} exceeds safe limits`);
  return parsed;
}

function isZeroBlock(bytes) {
  for (const byte of bytes) if (byte !== 0) return false;
  return true;
}

function displayTarType(type) {
  if (type >= 0x20 && type <= 0x7e) return JSON.stringify(String.fromCharCode(type));
  return `0x${type.toString(16).padStart(2, "0")}`;
}

function normalizeRuntimePaths(requiredRuntimePaths) {
  if (requiredRuntimePaths === undefined) return new Set();
  if (requiredRuntimePaths instanceof Set) return new Set(requiredRuntimePaths);
  if (Array.isArray(requiredRuntimePaths)) return new Set(requiredRuntimePaths);
  throw new Error("npm package validation requires runtime paths in a Set or array");
}

function expectedNpmPackagePaths(version, ownedPaths, runtimePaths) {
  return new Set([
    ...packageCommonPaths(version),
    ...NPM_ONLY_PACKAGE_PATHS,
    ...ownedPaths,
    ...runtimePaths
  ]);
}

async function packExactNpmArtifact(projectRoot, version) {
  await assertGeneratedBuildRuntime(projectRoot);
  const ownership = await loadPackageOwnership(projectRoot);
  const trustedHashes = await loadTrustedNpmInputHashes(projectRoot, version, ownership);
  const first = await packOnce(projectRoot, version, ownership.paths, trustedHashes);
  const second = await packOnce(projectRoot, version, ownership.paths, trustedHashes);
  if (!first.bytes.equals(second.bytes))
    throw new Error("Two npm pack runs produced different release artifact bytes");
  if (JSON.stringify(first.report) !== JSON.stringify(second.report))
    throw new Error("Two npm pack runs produced different package inventory reports");
  return first;
}

export async function loadTrustedNpmInputHashes(projectRoot, version, ownership) {
  if (!(ownership?.paths instanceof Set) || !(ownership?.hashes instanceof Map))
    throw new Error("Trusted npm input hashing requires validated package ownership");
  const paths = expectedNpmPackagePaths(
    version,
    ownership.paths,
    new Set(GENERATED_BUILD_RUNTIME_PATHS)
  );
  const hashes = new Map();
  for (const path of paths) {
    const absolute = join(projectRoot, ...path.split("/"));
    await assertNoSymlinkPath(projectRoot, absolute);
    let info;
    try {
      info = await lstat(absolute);
    } catch (error) {
      throw new Error(`Required npm package input is missing: ${path}`, { cause: error });
    }
    if (info.isSymbolicLink() || !info.isFile())
      throw new Error(`Required npm package input is not a regular file: ${path}`);
    if (info.nlink !== 1)
      throw new Error(`Hard-linked npm package input is forbidden (nlink=${info.nlink}): ${path}`);
    const hash = sha256(await readFile(absolute));
    const ownedHash = ownership.hashes.get(path);
    if (ownedHash !== undefined && ownedHash !== hash)
      throw new Error(`Required npm package input differs from generated ownership: ${path}`);
    hashes.set(path, hash);
  }
  return hashes;
}

async function packOnce(projectRoot, version, ownedPaths, trustedHashes) {
  const temporary = await mkdtemp(join(tmpdir(), PACK_TEMP_PREFIX));
  assertPackTemporary(temporary);
  try {
    const npmCli = await resolveNpmCli();
    let result;
    try {
      result = await runFile(
        process.execPath,
        [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", temporary],
        {
          cwd: projectRoot,
          encoding: "utf8",
          windowsHide: true,
          timeout: 10 * 60_000,
          maxBuffer: 20 * 1024 * 1024
        }
      );
    } catch (error) {
      throw new Error(`npm pack failed with exit code ${numericExitCode(error)}`, { cause: error });
    }
    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      throw new Error("npm pack did not return valid JSON");
    }
    const filename = report?.[0]?.filename;
    if (typeof filename !== "string" || basename(filename) !== filename)
      throw new Error("npm pack returned an unsafe archive filename");
    const packagePath = join(temporary, filename);
    const info = await lstat(packagePath);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error("npm pack did not produce a regular package artifact");
    if (info.nlink !== 1)
      throw new Error(`npm pack produced a hard-linked package artifact (nlink=${info.nlink})`);
    const bytes = await readFile(packagePath);
    const normalized = validateNpmPackReport(
      report,
      version,
      bytes,
      ownedPaths,
      GENERATED_BUILD_RUNTIME_PATHS,
      trustedHashes
    );
    return { bytes, report: normalized };
  } finally {
    await removePackTemporary(temporary);
  }
}

export async function resolveNpmCli() {
  // Do not honor npm_execpath here. It is an environment-controlled executable path and can point
  // at an arbitrary regular npm-cli.js outside the Node installation. Packaging must invoke only
  // the npm CLI shipped alongside the trusted Node executable used for this run.
  const candidates = [
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ];
  for (const value of candidates) {
    const candidate = resolve(value);
    if (basename(candidate).toLowerCase() !== "npm-cli.js") continue;
    try {
      const info = await lstat(candidate);
      if (info.isFile() && !info.isSymbolicLink()) return candidate;
    } catch {
      // Try the next allowlisted npm installation layout.
    }
  }
  throw new Error("Could not locate an allowlisted regular npm-cli.js entry point");
}

async function readSourceIdentity(projectRoot) {
  let revisionResult;
  let createdResult;
  try {
    [revisionResult, createdResult] = await Promise.all([
      runFile("git", ["rev-parse", "HEAD"], {
        cwd: projectRoot,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000
      }),
      runFile("git", ["show", "-s", "--format=%cI", "HEAD"], {
        cwd: projectRoot,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000
      })
    ]);
  } catch (error) {
    throw new Error("Could not bind release artifacts to the source revision", { cause: error });
  }
  const revision = revisionResult.stdout.trim();
  const date = new Date(createdResult.stdout.trim());
  const created = Number.isFinite(date.getTime()) ? date.toISOString() : "";
  if (!/^[a-f0-9]{40}$/u.test(revision) || !isCanonicalTimestamp(created))
    throw new Error("Release source identity is malformed");
  return { revision, created };
}

function runtimeNpmPackages(packageLock, version) {
  if (
    !isRecord(packageLock) ||
    packageLock.lockfileVersion !== 3 ||
    !isRecord(packageLock.packages)
  )
    throw new Error("Release SBOM requires npm package-lock lockfileVersion 3");
  const root = packageLock.packages[""];
  if (
    !isRecord(root) ||
    root.name !== PACKAGE_NAME ||
    root.version !== version ||
    root.license !== "Apache-2.0"
  )
    throw new Error("Release SBOM package-lock root does not match the release package");
  const output = [];
  const visited = new Set();
  const queue = Object.keys(isRecord(root.dependencies) ? root.dependencies : {}).map((name) => ({
    name,
    parentPath: ""
  }));
  while (queue.length > 0) {
    const request = queue.shift();
    const path = resolveLockPackagePath(packageLock.packages, request.parentPath, request.name);
    if (path === undefined)
      throw new Error(`Release SBOM lockfile omits runtime dependency ${request.name}`);
    if (visited.has(path)) continue;
    visited.add(path);
    const entry = packageLock.packages[path];
    if (
      !isRecord(entry) ||
      typeof entry.version !== "string" ||
      entry.version.length === 0 ||
      typeof entry.resolved !== "string" ||
      typeof entry.license !== "string" ||
      entry.license.length === 0
    )
      throw new Error(`Release SBOM lockfile record is invalid for ${request.name}`);
    const resolved = safeRegistryUrl(entry.resolved, request.name);
    const dependency = {
      name: packageNameFromLockPath(path),
      version: entry.version,
      resolved,
      license: entry.license,
      checksum: parseSha512Integrity(entry.integrity, `${request.name} integrity`),
      spdxId: spdxId("NPM", `${packageNameFromLockPath(path)}@${entry.version}`)
    };
    output.push(dependency);
    for (const name of Object.keys(isRecord(entry.dependencies) ? entry.dependencies : {}))
      queue.push({ name, parentPath: path });
    for (const name of Object.keys(
      isRecord(entry.optionalDependencies) ? entry.optionalDependencies : {}
    ))
      queue.push({ name, parentPath: path });
  }
  return output.sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`)
  );
}

function vendoredProviders(registry) {
  if (!isRecord(registry) || registry.schemaVersion !== 1 || !Array.isArray(registry.providers))
    throw new Error("Release SBOM upstream provider registry is invalid");
  const ids = new Set();
  return registry.providers
    .map((provider) => {
      if (
        !isRecord(provider) ||
        typeof provider.id !== "string" ||
        !/^[a-z0-9][a-z0-9-]*$/u.test(provider.id) ||
        ids.has(provider.id) ||
        typeof provider.displayName !== "string" ||
        provider.displayName.length === 0 ||
        typeof provider.repository !== "string" ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(provider.repository) ||
        typeof provider.upstreamCommit !== "string" ||
        !/^[a-f0-9]{40}$/u.test(provider.upstreamCommit) ||
        (provider.upstreamTag !== null && typeof provider.upstreamTag !== "string") ||
        typeof provider.license !== "string" ||
        provider.license.length === 0 ||
        (provider.copyright !== null && typeof provider.copyright !== "string") ||
        typeof provider.runtimeChecksum !== "string" ||
        !/^[a-f0-9]{64}$/u.test(provider.runtimeChecksum)
      )
        throw new Error("Release SBOM contains an invalid upstream provider record");
      ids.add(provider.id);
      return {
        id: provider.id,
        displayName: provider.displayName,
        repository: provider.repository,
        upstreamCommit: provider.upstreamCommit,
        upstreamTag: provider.upstreamTag,
        license: provider.license,
        copyright: provider.copyright,
        runtimeChecksum: provider.runtimeChecksum,
        spdxId: spdxId("Vendored", provider.id)
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function resolveLockPackagePath(packages, parentPath, name) {
  let cursor = parentPath;
  while (true) {
    const candidate =
      cursor.length === 0 ? `node_modules/${name}` : `${cursor}/node_modules/${name}`;
    if (isRecord(packages[candidate])) return candidate;
    const marker = cursor.lastIndexOf("/node_modules/");
    if (marker < 0) {
      if (cursor.length === 0) return undefined;
      cursor = "";
    } else cursor = cursor.slice(0, marker);
  }
}

function packageNameFromLockPath(path) {
  const marker = path.lastIndexOf("node_modules/");
  return path.slice(marker + "node_modules/".length);
}

function parseSha512Integrity(value, label) {
  if (typeof value !== "string") throw new Error(`Release SBOM ${label} is missing`);
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/u.exec(value);
  if (match?.[1] === undefined) throw new Error(`Release SBOM ${label} is not SHA-512 SRI`);
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length !== 64 || bytes.toString("base64") !== match[1])
    throw new Error(`Release SBOM ${label} is malformed`);
  return { algorithm: "SHA512", checksumValue: bytes.toString("hex") };
}

function safeRegistryUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Release SBOM runtime dependency ${name} has an invalid source URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "registry.npmjs.org" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error(`Release SBOM runtime dependency ${name} has an untrusted source URL`);
  return url.toString();
}

function npmPurl(name, version) {
  const encodedName = name.startsWith("@")
    ? `${encodeURIComponent(name.split("/")[0])}/${encodeURIComponent(name.split("/")[1] ?? "")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function spdxId(kind, value) {
  const readable = value.replace(/[^A-Za-z0-9.-]+/gu, "-").replace(/^-+|-+$/gu, "") || "item";
  return `SPDXRef-${kind}-${readable}-${sha256(Buffer.from(value)).slice(0, 12)}`;
}

function assertStableVersion(version) {
  if (
    typeof version !== "string" ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(version)
  )
    throw new Error(`Release artifact version must be a stable semantic version: ${version}`);
}

function isCanonicalTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function assertPackTemporary(path) {
  const resolved = resolve(path);
  const temporaryRoot = resolve(tmpdir());
  if (
    !resolved.startsWith(`${temporaryRoot}${sep}`) ||
    !basename(resolved).startsWith(PACK_TEMP_PREFIX)
  )
    throw new Error(`Refusing unsafe npm-pack temporary directory: ${resolved}`);
}

async function removePackTemporary(path) {
  assertPackTemporary(path);
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries)
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      !/^fullstack-forge-skill-\d+\.\d+\.\d+\.tgz$/u.test(entry.name)
    )
      throw new Error(`Refusing to remove unexpected npm-pack temporary content: ${entry.name}`);
  await rm(path, { recursive: true });
}

async function readJson(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label}`, { cause: error });
  }
  return parsed;
}

function numericExitCode(error) {
  return typeof error?.code === "number" ? error.code : 1;
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
