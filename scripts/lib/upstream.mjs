// Vendored-upstream registry: selection, safety screening, checksums, and manifest records.
//
// Fullstack Forge vendors specialist expertise from a fixed set of upstream repositories. Every
// import is pinned to an immutable commit, allowlisted path by path, screened for content that
// could subvert Forge's contracts, and recorded with a content checksum. Nothing here reaches the
// network: `upstream-update.mjs` and `upstream-check.mjs` are the only network callers, and both
// are maintainer-only. Ordinary development, installation, and runtime use read these records
// offline.

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { assertSafeRelativePath } from "./fs-safety.mjs";
import { projectRoot } from "../project.mjs";

export const THIRD_PARTY_ROOT = join(projectRoot, "third_party", "agent-skills");
export const PROVIDER_CONFIG_PATH = join(projectRoot, "config", "upstream-providers.json");
export const CONTENT_DIRNAME = "content";
export const RECORD_FILENAME = "UPSTREAM.json";
export const CHECKSUM_FILENAME = "checksums.json";

/** Files Forge is willing to treat as inert guidance rather than as an executable import. */
const DEFAULT_DOCUMENT_EXTENSIONS = Object.freeze([
  ".md",
  ".mdc",
  ".json",
  ".txt",
  ".yaml",
  ".yml"
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]*$/u;
const ALLOWED_LICENSES = Object.freeze(["Apache-2.0", "MIT"]);

/** A Git LFS pointer stands in for content that was never fetched; importing one imports nothing. */
const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/";

/** Upper bound for a single vendored file. Guidance does not need a megabyte. */
export const MAX_FILE_BYTES = 512 * 1024;

export async function readProviderConfig() {
  const raw = JSON.parse(await readFile(PROVIDER_CONFIG_PATH, "utf8"));
  if (!Array.isArray(raw?.providers) || raw.providers.length === 0)
    throw new Error("config/upstream-providers.json must declare a non-empty providers array");
  const extensions = Array.isArray(raw.documentFileExtensions)
    ? raw.documentFileExtensions
    : DEFAULT_DOCUMENT_EXTENSIONS;
  const seen = new Set();
  for (const provider of raw.providers) {
    validateProviderSelection(provider);
    if (seen.has(provider.id)) throw new Error(`Duplicate upstream provider id: ${provider.id}`);
    seen.add(provider.id);
  }
  return { providers: raw.providers, documentFileExtensions: extensions };
}

export function validateProviderSelection(provider) {
  const id = provider?.id;
  if (typeof id !== "string" || !PROVIDER_ID_PATTERN.test(id))
    throw new Error(`Invalid upstream provider id: ${JSON.stringify(id)}`);
  if (typeof provider.repository !== "string" || !/^[\w.-]+\/[\w.-]+$/u.test(provider.repository))
    throw new Error(`Provider ${id} must declare repository as "owner/name"`);
  if (typeof provider.upstreamCommit !== "string" || !SHA_PATTERN.test(provider.upstreamCommit))
    throw new Error(`Provider ${id} must pin a full 40-character commit SHA, not a branch or tag`);
  if (provider.upstreamTag !== null && typeof provider.upstreamTag !== "string")
    throw new Error(`Provider ${id} upstreamTag must be a string or null`);
  if (!ALLOWED_LICENSES.includes(provider.license))
    throw new Error(`Provider ${id} declares an unsupported license: ${provider.license}`);
  if (typeof provider.licenseEvidence !== "string" || provider.licenseEvidence.length === 0)
    throw new Error(`Provider ${id} must record where its licence grant was read from`);
  if (provider.updatePolicy !== "reviewed-only")
    throw new Error(`Provider ${id} must use updatePolicy "reviewed-only"`);
  for (const field of ["selectedPaths", "excludedPaths", "runtimeExecutables"]) {
    if (!Array.isArray(provider[field]))
      throw new Error(`Provider ${id} field ${field} must be an array`);
    for (const value of provider[field]) {
      if (typeof value !== "string" || value.length === 0)
        throw new Error(`Provider ${id} field ${field} contains a non-string entry`);
      if (value.includes("\\"))
        throw new Error(`Provider ${id} ${field} must use POSIX separators`);
      if (!value.startsWith("**/"))
        assertSafeRelativePath(value.replace(/\/$/u, ""), `${field} entry`);
    }
  }
  if (provider.selectedPaths.length === 0)
    throw new Error(`Provider ${id} must select at least one path`);
}

/**
 * Selection is allowlist-first: a path is imported only when it matches `selectedPaths` and does
 * not match `excludedPaths`. Three pattern forms are supported and nothing else, so a selection
 * can always be read literally:
 *
 *   1. an exact path, such as `LICENSE`;
 *   2. a directory prefix ending in a slash, such as `skills/supabase/`;
 *   3. a doublestar-anchored suffix matching any depth — an extension (doublestar, slash, star,
 *      dot, `py`) or a directory name (doublestar, slash, `scripts`, slash).
 */
export function matchesPattern(path, pattern) {
  if (pattern.startsWith("**/")) {
    const tail = pattern.slice(3);
    if (tail.startsWith("*.")) return path.endsWith(tail.slice(1));
    if (tail.endsWith("/")) return path.startsWith(tail) || path.includes(`/${tail}`);
    return path === tail || path.endsWith(`/${tail}`);
  }
  if (pattern.endsWith("/")) return path.startsWith(pattern);
  return path === pattern;
}

export function isSelected(path, provider) {
  if (provider.excludedPaths.some((pattern) => matchesPattern(path, pattern))) return false;
  return provider.selectedPaths.some((pattern) => matchesPattern(path, pattern));
}

export function isDocumentPath(path, documentFileExtensions) {
  const lower = path.toLowerCase();
  return (
    documentFileExtensions.some((ext) => lower.endsWith(ext)) ||
    lower.endsWith("/license") ||
    lower === "license" ||
    lower.endsWith("/notice") ||
    lower === "notice"
  );
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * One checksum over the whole selection. Order-independent inputs would let a file be swapped for
 * another with the same bytes, so the digest binds each path to its own content hash in sorted
 * order.
 */
export function contentChecksum(files) {
  const hash = createHash("sha256");
  for (const path of [...files.keys()].sort()) hash.update(`${path}\n${files.get(path)}\n`);
  return hash.digest("hex");
}

/**
 * Screens one vendored file. Upstream Markdown and scripts are untrusted until reviewed: this is
 * the mechanical half of that review, and it fails closed. `strict` adds the checks that only make
 * sense at import time, when the maintainer can still choose to exclude the path.
 */
export function screenFile({ path, buffer, provider, documentFileExtensions }) {
  const problems = [];
  assertSafeRelativePath(path, "vendored path");
  if (path.split("/").includes(".git")) problems.push("nested Git repository content");
  if (buffer.length > MAX_FILE_BYTES && !provider.runtimeExecutables.includes(path))
    problems.push(`file exceeds ${MAX_FILE_BYTES} bytes (${buffer.length})`);
  const isDocument = isDocumentPath(path, documentFileExtensions);
  if (!isDocument && !provider.runtimeExecutables.includes(path))
    problems.push("undeclared executable or binary import");
  const head = buffer.subarray(0, 256).toString("utf8");
  if (head.startsWith(LFS_POINTER_PREFIX)) problems.push("Git LFS pointer without fetched content");
  if (isDocument && buffer.includes(0)) problems.push("binary content in a document path");
  return problems;
}

/**
 * Instructions that would let vendored guidance step outside Forge's approval boundaries. A hit is
 * not automatically fatal — plenty of legitimate guidance discusses deploying or publishing — so
 * this returns findings for the maintainer's review record rather than throwing. `upstream:verify`
 * fails only on the categories that can never be advisory, which `HARD_DENY` marks.
 */
export const DANGEROUS_INSTRUCTION_RULES = Object.freeze([
  {
    id: "auto-update",
    pattern:
      /\b(?:check|checks|checking)\s+for\s+(?:the\s+)?(?:latest|new(?:er)?)\s+(?:version|release)/iu,
    hardDeny: true
  },
  {
    id: "telemetry",
    pattern:
      /\b(?:telemetry|analytics)\.(?:track|send|report)\b|\bposthog\b|\bsend\s+usage\s+data\b/iu,
    hardDeny: true
  },
  { id: "force-push", pattern: /\bgit\s+push\s+(?:--force|-f)\b/iu, hardDeny: true },
  {
    id: "skip-verification",
    pattern: /--no-verify\b|\bskip\s+(?:the\s+)?(?:hooks|verification)\b/iu,
    hardDeny: false
  },
  {
    id: "global-install",
    pattern: /\bnpm\s+i(?:nstall)?\s+-g\b|\byarn\s+global\s+add\b/iu,
    hardDeny: false
  },
  {
    id: "credential-read",
    pattern: /\bcat\s+[~.\w/]*(?:\.env|\.npmrc|id_rsa|credentials)\b/iu,
    hardDeny: true
  },
  {
    id: "remote-exec",
    pattern: /\bcurl\b[^\n]*\|\s*(?:ba)?sh\b|\bwget\b[^\n]*\|\s*(?:ba)?sh\b/iu,
    hardDeny: true
  },
  { id: "auto-publish", pattern: /\bnpm\s+publish\b/iu, hardDeny: false },
  {
    id: "prompt-override",
    pattern:
      /\bignore\s+(?:all\s+)?(?:previous|prior)\s+instructions\b|\boverride\s+the\s+system\s+prompt\b/iu,
    hardDeny: true
  }
]);

export function scanDangerousInstructions(path, text) {
  const findings = [];
  for (const rule of DANGEROUS_INSTRUCTION_RULES) {
    const match = rule.pattern.exec(text);
    if (match === null) continue;
    findings.push({
      path,
      rule: rule.id,
      hardDeny: rule.hardDeny,
      evidence: excerpt(text, match.index)
    });
  }
  return findings;
}

function excerpt(text, index) {
  const start = Math.max(0, index - 40);
  return text
    .slice(start, index + 80)
    .replace(/\s+/gu, " ")
    .trim();
}

export function providerDirectory(id) {
  return join(THIRD_PARTY_ROOT, id);
}

export async function readProviderRecord(id) {
  const path = join(providerDirectory(id), RECORD_FILENAME);
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readProviderChecksums(id) {
  const path = join(providerDirectory(id), CHECKSUM_FILENAME);
  return JSON.parse(await readFile(path, "utf8"));
}

/** Every vendored file of one provider, as POSIX paths relative to its `content/` directory. */
export async function listContentFiles(id) {
  const root = join(providerDirectory(id), CONTENT_DIRNAME);
  const out = [];
  await walk(root, root, out);
  return out.sort();
}

async function walk(root, directory, out) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing vendored symlink: ${full}`);
    if (entry.isDirectory()) await walk(root, full, out);
    else if (entry.isFile()) out.push(relative(root, full).split(sep).join(posix.sep));
    else throw new Error(`Refusing irregular vendored entry: ${full}`);
  }
}

export async function fileSize(path) {
  return (await stat(path)).size;
}

export function formatProviderLine(record) {
  const tag = record.upstreamTag ?? "(no stable tag; pinned default-branch head)";
  return `${record.id.padEnd(22)} ${record.license.padEnd(11)} ${tag.padEnd(34)} ${record.upstreamCommit}`;
}
