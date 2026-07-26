import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateArchiveBytes } from "./lib/archive-validation.mjs";
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
const requiredEntries = [
  "README.md",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "docs/ANALYZER_SUPPORT.md",
  `docs/AUDIT_CLASSIFICATION_v${version}.md`,
  "docs/COVERAGE.md",
  "docs/GETTING_STARTED.md",
  "docs/REPOSITORY_INVENTORY.md",
  "docs/REPORT_SCHEMA.md",
  "docs/TRACEABILITY.md",
  "docs/TRACEABILITY_MATRIX.md",
  "research/SOURCES.md",
  "examples/quickstart-demo/README.md",
  `docs/RELEASE_NOTES_v${version}.md`,
  `docs/RELEASE_VERIFICATION_v${version}.md`
];
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
  const entries = validateArchiveBytes(bytes, name, version);
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
