import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { crc32 } from "./lib/zip.mjs";
import { assertNoSymlinkPath, assertRegularFile } from "./lib/fs-safety.mjs";
import { projectRoot } from "./project.mjs";

const distRoot = join(projectRoot, "dist");
await assertNoSymlinkPath(projectRoot, distRoot);
const version = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")).version;
const expected = [
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
const requiredEntries = ["README.md", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"];
const forbidden = /(?:^|\/)(?:node_modules|\.git|\.tmp)(?:\/|$)|fullstack[-_]forge[-_]spec/iu;

await assertRegularFile(join(distRoot, "manifest.json"), "distribution manifest");
await assertRegularFile(join(distRoot, "SHA256SUMS.txt"), "checksum file");
const manifest = JSON.parse(await readFile(join(distRoot, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 1 || manifest.version !== version || manifest.deterministic !== true)
  throw new Error("Distribution manifest metadata is invalid");
const manifestNames = Object.keys(manifest.archives ?? {}).sort();
if (JSON.stringify(manifestNames) !== JSON.stringify([...expected].sort()))
  throw new Error("Distribution manifest archive set is incomplete or contains extras");

const checksumText = await readFile(join(distRoot, "SHA256SUMS.txt"), "utf8");
const checksums = new Map();
for (const line of checksumText.trim().split(/\r?\n/u)) {
  const match = /^([a-f0-9]{64}) {2}([^/\\]+)$/u.exec(line);
  if (match === null) throw new Error(`Invalid SHA256SUMS line: ${line}`);
  checksums.set(match[2], match[1]);
}
if (JSON.stringify([...checksums.keys()].sort()) !== JSON.stringify([...expected].sort()))
  throw new Error("SHA256SUMS archive set is incomplete or contains extras");

let totalEntries = 0;
for (const name of expected) {
  await assertRegularFile(join(distRoot, name), "distribution archive");
  const bytes = await readFile(join(distRoot, name));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (checksums.get(name) !== hash || manifest.archives[name]?.sha256 !== hash)
    throw new Error(`Checksum mismatch for ${name}`);
  if (manifest.archives[name]?.bytes !== bytes.length)
    throw new Error(`Byte count mismatch for ${name}`);
  const entries = readStoredZip(bytes, name);
  totalEntries += entries.length;
  const names = new Set(entries.map((entry) => entry.name));
  for (const required of requiredEntries)
    if (!names.has(required)) throw new Error(`${name} is missing ${required}`);
  if (![...names].some((entry) => entry.endsWith("/fullstack-forge/SKILL.md")))
    throw new Error(`${name} contains no Fullstack Forge master skill`);
}

console.log(
  JSON.stringify(
    { valid: true, version, archives: expected.length, entries: totalEntries },
    null,
    2
  )
);

function readStoredZip(bytes, archiveName) {
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
      name.split("/").some((part) => part === "" || part === "." || part === "..") ||
      forbidden.test(name)
    )
      throw new Error(`${archiveName} contains forbidden entry ${name}`);
    if (seen.has(name)) throw new Error(`${archiveName} contains duplicate entry ${name}`);
    seen.add(name);
    if ((flags & 0x0800) === 0 || method !== 0 || time !== 0 || date !== 33)
      throw new Error(`${archiveName}:${name} violates deterministic UTF-8/store metadata`);
    if (compressed !== uncompressed)
      throw new Error(`${archiveName}:${name} uses an unexpected compression size`);
    const mode = external >>> 16;
    if ((mode & 0o170000) === 0o120000) throw new Error(`${archiveName}:${name} is a symlink`);
    verifyLocalEntry(bytes, archiveName, name, localOffset, compressed, crc);
    entries.push({ name, bytes: uncompressed });
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
}
