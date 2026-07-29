import { posix } from "node:path";
import { assertPublishableArchivePath } from "./package-policy.mjs";
import { crc32 } from "./zip.mjs";

const legacyOwner = "the" + "thunderbolt";
const LEGACY_PUBLIC_REFERENCE = new RegExp(
  String.raw`(?:https?:\/\/(?:www\.)?github\.com\/${legacyOwner}\/|git\+https:\/\/github\.com\/${legacyOwner}\/|github:${legacyOwner}\/|https?:\/\/raw\.githubusercontent\.com\/${legacyOwner}\/|https?:\/\/api\.github\.com\/repos\/${legacyOwner}\/)`,
  "iu"
);

export function validateArchiveBytes(bytes, archiveName, version) {
  const entries = readStoredZip(bytes, archiveName, version);
  validatePackagedMarkdown(entries, archiveName);
  return entries;
}

export function validatePackagedMarkdown(entries, archiveName) {
  const names = new Set(entries.map((entry) => entry.name));
  const errors = [];
  for (const entry of entries) {
    const content = entry.data.toString("utf8");
    if (LEGACY_PUBLIC_REFERENCE.test(content))
      errors.push(`${archiveName}:${entry.name} contains an old-owner public link`);
    if (!entry.name.endsWith(".md")) continue;
    // Compiled upstream references are screened against their provider runtime set during
    // generation. Their Markdown also intentionally contains user-project example paths such as
    // `/hero.jpg`, which are not archive links and must not be resolved as package assets here.
    if (entry.name.startsWith(".fullstack-forge/upstream/")) continue;
    for (const target of markdownTargets(content)) {
      if (isExternalOrAnchor(target)) continue;
      const destination = resolvePackagedLink(entry.name, target);
      if (destination.error !== undefined) {
        errors.push(`${archiveName}:${entry.name} ${destination.error}: ${target}`);
        continue;
      }
      if (
        !names.has(destination.path) &&
        ![...names].some((name) => name.startsWith(`${destination.path.replace(/\/$/u, "")}/`))
      )
        errors.push(
          `${archiveName}:${entry.name} links to missing packaged destination ${destination.path} (${target})`
        );
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

function readStoredZip(bytes, archiveName, version) {
  if (bytes.length < 22) throw new Error(`${archiveName} is too short to be a ZIP`);
  const endOffset = bytes.length - 22;
  if (bytes.readUInt32LE(endOffset) !== 0x06054b50)
    throw new Error(`${archiveName} has no deterministic end-of-central-directory record`);
  if (bytes.readUInt16LE(endOffset + 4) !== 0 || bytes.readUInt16LE(endOffset + 6) !== 0)
    throw new Error(`${archiveName} uses unsupported multi-disk ZIP records`);
  const count = bytes.readUInt16LE(endOffset + 10);
  if (bytes.readUInt16LE(endOffset + 8) !== count)
    throw new Error(`${archiveName} has inconsistent ZIP entry counts`);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset)
    throw new Error(`${archiveName} has an invalid central directory boundary`);

  const entries = [];
  const seen = new Set();
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > endOffset || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error(`${archiveName} has an invalid central directory entry`);
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const time = bytes.readUInt16LE(offset + 12);
    const date = bytes.readUInt16LE(offset + 14);
    const crc = bytes.readUInt32LE(offset + 16);
    const compressed = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const external = bytes.readUInt32LE(offset + 38);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > endOffset) throw new Error(`${archiveName} has a truncated central entry`);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (
      name.length === 0 ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").some((part) => part === "" || part === "." || part === "..")
    )
      throw new Error(`${archiveName} contains forbidden entry ${name}`);
    assertPublishableArchivePath(name, version);
    if (seen.has(name)) throw new Error(`${archiveName} contains duplicate entry ${name}`);
    seen.add(name);
    if ((flags & 0x0800) === 0 || method !== 0 || time !== 0 || date !== 33)
      throw new Error(`${archiveName}:${name} violates deterministic UTF-8/store metadata`);
    if (compressed !== uncompressed)
      throw new Error(`${archiveName}:${name} uses an unexpected compression size`);
    const mode = external >>> 16;
    if ((mode & 0o170000) === 0o120000) throw new Error(`${archiveName}:${name} is a symlink`);
    entries.push({
      name,
      data: verifyLocalEntry(bytes, archiveName, name, localOffset, compressed, crc)
    });
    offset = next;
  }
  if (offset !== endOffset) throw new Error(`${archiveName} has trailing central-directory data`);
  return entries;
}

function verifyLocalEntry(bytes, archiveName, name, offset, size, expectedCrc) {
  if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50)
    throw new Error(`${archiveName}:${name} has an invalid local header`);
  const localNameLength = bytes.readUInt16LE(offset + 26);
  const localExtraLength = bytes.readUInt16LE(offset + 28);
  const localName = bytes.subarray(offset + 30, offset + 30 + localNameLength).toString("utf8");
  if (localName !== name) throw new Error(`${archiveName}:${name} local name differs`);
  if (
    bytes.readUInt16LE(offset + 8) !== 0 ||
    bytes.readUInt32LE(offset + 14) !== expectedCrc ||
    bytes.readUInt32LE(offset + 18) !== size ||
    bytes.readUInt32LE(offset + 22) !== size
  )
    throw new Error(`${archiveName}:${name} local metadata differs`);
  const start = offset + 30 + localNameLength + localExtraLength;
  const end = start + size;
  if (end > bytes.length || crc32(bytes.subarray(start, end)) !== expectedCrc)
    throw new Error(`${archiveName}:${name} payload CRC is invalid`);
  return bytes.subarray(start, end);
}

function markdownTargets(content) {
  const targets = [];
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) targets.push(match[1] ?? "");
  for (const match of content.matchAll(/<img\s+([^>]+)>/giu)) {
    const source = /\bsrc=["']([^"']+)["']/iu.exec(match[1] ?? "")?.[1];
    if (source !== undefined) targets.push(source);
  }
  return targets;
}

function isExternalOrAnchor(target) {
  return /^(?:https?:|mailto:|tel:|#)/iu.test(target.trim());
}

function resolvePackagedLink(source, rawTarget) {
  const normalized = rawTarget.trim().replace(/^<|>$/gu, "");
  const targetWithTitle = normalized.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  if (targetWithTitle.length === 0) return { path: source };
  let decoded;
  try {
    decoded = decodeURIComponent(targetWithTitle);
  } catch {
    return { error: "has invalid URL encoding" };
  }
  if (decoded.startsWith("/") || decoded.includes("\\"))
    return { error: "uses an unsafe local link" };
  const path = posix.normalize(posix.join(posix.dirname(source), decoded));
  if (path === ".." || path.startsWith("../")) return { error: "link escapes the archive" };
  return { path };
}
