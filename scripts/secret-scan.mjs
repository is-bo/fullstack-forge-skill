import { lstat, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { listWorktreeFiles } from "./lib/git-files.mjs";
import { projectRoot } from "./project.mjs";

const binary = new Set([".gif", ".ico", ".jpeg", ".jpg", ".pdf", ".png", ".tgz", ".zip"]);
const patterns = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/gu],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/gu],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/gu],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu],
  [
    "assigned-secret",
    /\b(?:api[_-]?key|client[_-]?secret|password|passwd|secret|token)\b\s*[:=]\s*["']?([^\s"',;]{12,})/giu
  ]
];
const listed = listWorktreeFiles(projectRoot);
const findings = [];
let scanned = 0;
for (const relative of listed) {
  const path = join(projectRoot, ...relative.split("/"));
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`Published symlinks are forbidden: ${relative}`);
  if (relative === "scripts/secret-scan.mjs" || binary.has(extname(relative).toLowerCase()))
    continue;
  if (info.size > 2 * 1024 * 1024) continue;
  const bytes = await readFile(path);
  if (bytes.includes(0)) continue;
  const content = bytes.toString("utf8");
  scanned += 1;
  for (const [kind, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const value = match[1] ?? match[0];
      if (isExplicitlySynthetic(value, relative)) continue;
      findings.push({ file: relative, line: lineOf(content, match.index ?? 0), kind });
    }
  }
}
if (findings.length > 0) {
  console.error(JSON.stringify({ valid: false, findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ valid: true, scanned_files: scanned, findings: 0 }, null, 2));
}

function isExplicitlySynthetic(value, relative) {
  const normalized = value.toLowerCase();
  // Redaction tests must embed credential-shaped values to prove the redactor removes them. Those
  // values are exempt only where fixtures live and only when the value names itself as synthetic,
  // so a genuine secret committed to a test still fails the scan.
  // `build/` mirrors the sources, so the compiled copy of a test is judged like its origin.
  const source = relative.startsWith("build/") ? relative.slice("build/".length) : relative;
  const syntheticRoot =
    source.startsWith("fixtures/") ||
    source.startsWith("cli/tests/") ||
    source.startsWith("scripts/tests/");
  return (
    syntheticRoot &&
    ["fixture", "example", "fake", "placeholder", "test", "redacted", "sentinel"].some((word) =>
      normalized.includes(word)
    )
  );
}

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length;
}
