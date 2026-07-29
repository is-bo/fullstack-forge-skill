// Maintainer-only: review a candidate upstream version before importing it.
//
//   node scripts/upstream-diff.mjs <provider> <tag-or-sha>
//
// Reports what would change in the selection if the candidate were imported: added, removed and
// modified files, licence changes, new scripts, command and frontmatter changes, token deltas, and
// any instruction that trips Forge's dangerous-instruction rules. Changes nothing on disk.

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONTENT_DIRNAME,
  isSelected,
  listContentFiles,
  providerDirectory,
  readProviderConfig,
  scanDangerousInstructions,
  sha256
} from "./lib/upstream.mjs";

const [providerId, target] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const config = await readProviderConfig();
const provider = config.providers.find((entry) => entry.id === providerId);

if (provider === undefined || target === undefined) {
  console.error(
    "Usage: node scripts/upstream-diff.mjs <provider> <tag-or-sha>\n\n" +
      `Providers: ${config.providers.map((entry) => entry.id).join(", ")}`
  );
  process.exit(2);
}

const workspace = await mkdtemp(join(tmpdir(), `forge-diff-${provider.id}-`));
try {
  const url = `https://github.com/${provider.repository}.git`;
  run("git", ["clone", "--quiet", "--no-checkout", url, workspace]);
  const commit = run("git", [
    "-C",
    workspace,
    "rev-parse",
    "--verify",
    `${target}^{commit}`
  ]).trim();
  console.log(`${provider.id}: ${provider.upstreamCommit} -> ${commit} (${target})\n`);
  if (commit === provider.upstreamCommit) {
    console.log("Candidate is identical to the current pin. Nothing to review.");
    process.exit(0);
  }

  const candidate = new Map();
  for (const line of run("git", ["-C", workspace, "ls-tree", "-r", commit]).split("\n")) {
    const match = /^(\d{6}) (blob|commit|tree) ([0-9a-f]{40})\t(.*)$/u.exec(line.trimEnd());
    if (match === null) continue;
    const [, mode, , blob, path] = match;
    if (isSelected(path, provider)) candidate.set(path, { mode, blob });
  }

  const currentPaths = await listContentFiles(provider.id);
  const current = new Map();
  for (const path of currentPaths)
    current.set(path, await readFile(join(providerDirectory(provider.id), CONTENT_DIRNAME, path)));

  const added = [...candidate.keys()].filter((path) => !current.has(path)).sort();
  const removed = currentPaths.filter((path) => !candidate.has(path)).sort();
  const modified = [];
  let tokenDelta = 0;
  const advisories = [];
  const frontmatterChanges = [];
  const newScripts = [];

  for (const [path, entry] of candidate) {
    const buffer = readBlob(workspace, entry.blob);
    if (!/\.(?:md|mdc|json|txt|ya?ml)$/iu.test(path))
      newScripts.push(`${path} (mode ${entry.mode})`);
    if (/\.(?:md|mdc|txt)$/iu.test(path))
      advisories.push(...scanDangerousInstructions(path, buffer.toString("utf8")));
    const before = current.get(path);
    if (before === undefined) {
      tokenDelta += estimateTokens(buffer);
      continue;
    }
    if (sha256(before) === sha256(buffer)) continue;
    modified.push(path);
    tokenDelta += estimateTokens(buffer) - estimateTokens(before);
    const beforeMatter = frontmatter(before.toString("utf8"));
    const afterMatter = frontmatter(buffer.toString("utf8"));
    if (beforeMatter !== afterMatter) frontmatterChanges.push(path);
  }
  for (const path of removed) tokenDelta -= estimateTokens(current.get(path));

  section("Added files", added);
  section("Removed files", removed);
  section("Modified files", modified);
  section("Frontmatter, name, description or trigger changes", frontmatterChanges);
  section("Non-document (script or binary) files in the candidate selection", newScripts);
  section(
    "Dangerous-instruction matches",
    advisories.map(
      (a) => `${a.hardDeny ? "HARD-DENY" : "note     "} ${a.rule} ${a.path}: ${a.evidence}`
    )
  );

  const licenceBefore = await readFile(join(providerDirectory(provider.id), "LICENSE"), "utf8");
  const licenceAfter = readLicence(workspace, commit, provider);
  console.log(
    `\n## Licence\n\n${licenceAfter === null ? "  MISSING upstream — do not import" : licenceAfter.trim() === licenceBefore.trim() ? "  unchanged" : "  CHANGED — review before importing"}`
  );

  console.log(
    `\n## Summary\n\n  ${added.length} added, ${removed.length} removed, ${modified.length} modified.` +
      `\n  Approximate instruction-token delta: ${tokenDelta >= 0 ? "+" : ""}${tokenDelta}.` +
      "\n\nNothing was changed. To import: node scripts/upstream-update.mjs " +
      `${provider.id} ${target}\n(then update the pin in config/upstream-providers.json first).`
  );
} finally {
  await rm(workspace, { recursive: true, force: true, maxRetries: 5 });
}

function section(title, values) {
  console.log(`\n## ${title}\n`);
  if (values.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const value of values.slice(0, 60)) console.log(`  ${value}`);
  if (values.length > 60) console.log(`  … and ${values.length - 60} more`);
}

function frontmatter(text) {
  const normalized = text.replace(/\r\n/gu, "\n");
  if (!normalized.startsWith("---\n")) return "";
  const end = normalized.indexOf("\n---\n", 3);
  return end === -1 ? "" : normalized.slice(4, end);
}

/** Deliberately crude: a stable proxy for context cost, not a tokenizer. */
function estimateTokens(buffer) {
  return Math.round(buffer.length / 4);
}

function readLicence(workspace, commit, provider) {
  const [file] = provider.licenseEvidence.split("#");
  const result = spawnSync("git", ["-C", workspace, "show", `${commit}:${file}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  return result.status === 0 ? result.stdout : null;
}

function readBlob(workspace, blob) {
  const result = spawnSync("git", ["-C", workspace, "cat-file", "blob", blob], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`Could not read blob ${blob}`);
  return result.stdout;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.slice(0, 3).join(" ")} failed: ${result.stderr?.trim() ?? ""}`
    );
  return result.stdout;
}
