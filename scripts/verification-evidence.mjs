#!/usr/bin/env node
/**
 * Emits candidate verification evidence from live Git metadata instead of a written-down SHA.
 *
 * A report that names its own candidate SHA invalidates itself the moment it is committed: the
 * commit that records the SHA changes the SHA. The same applies to "N commits ahead". This script
 * therefore derives that evidence at verification time, so the durable document can state the
 * baseline and the branch — which do not change — while the volatile facts are produced by whoever
 * actually ran the checks, in the environment that ran them.
 *
 * The output is deliberately not committed. `--output` defaults under `.tmp/`, which `.gitignore`
 * excludes; in CI the markdown is appended to the job summary instead.
 *
 * Usage:
 *   node scripts/verification-evidence.mjs [--baseline <ref>] [--output <path>] [--format md|json]
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_BASELINE = "origin/main";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith("--") && values[index + 1] !== undefined)
      pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, [])
);

/** Runs a Git query and returns trimmed stdout, or `undefined` when the query does not apply. */
function git(...argv) {
  try {
    return execFileSync("git", argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const baseline = typeof args.baseline === "string" ? args.baseline : DEFAULT_BASELINE;
const head = git("rev-parse", "HEAD");
if (head === undefined) throw new Error("Not inside a Git working tree.");

const mergeBase = git("merge-base", baseline, "HEAD");
const evidence = {
  generatedAt: new Date().toISOString(),
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  candidate: head,
  candidateSubject: git("log", "-1", "--format=%s"),
  candidateCommittedAt: git("log", "-1", "--format=%cI"),
  baselineRef: baseline,
  baselineCommit: mergeBase,
  commitsAheadOfBaseline:
    mergeBase === undefined ? undefined : git("rev-list", "--count", `${mergeBase}..HEAD`),
  workingTreeClean: git("status", "--porcelain") === "",
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  ci: process.env.GITHUB_ACTIONS === "true" ? (process.env.GITHUB_RUN_ID ?? "unknown") : undefined
};

/**
 * Renders the evidence as a markdown table.
 *
 * Every row is a fact read from the environment at run time. Nothing here is asserted by the
 * document that embeds it, which is the point: a reader can re-run this command and compare.
 */
function renderMarkdown(value) {
  const rows = [
    ["Branch", value.branch],
    ["Candidate commit", value.candidate === undefined ? undefined : `\`${value.candidate}\``],
    ["Candidate subject", value.candidateSubject],
    ["Candidate committed", value.candidateCommittedAt],
    ["Baseline ref", value.baselineRef === undefined ? undefined : `\`${value.baselineRef}\``],
    [
      "Baseline commit",
      value.baselineCommit === undefined ? undefined : `\`${value.baselineCommit}\``
    ],
    ["Commits ahead of baseline", value.commitsAheadOfBaseline],
    ["Working tree clean", value.workingTreeClean ? "yes" : "no"],
    ["Node", value.node],
    ["Platform", value.platform],
    ["GitHub Actions run", value.ci],
    ["Generated at", value.generatedAt]
  ].filter(([, cell]) => cell !== undefined && cell !== "");
  return [
    "### Candidate verification evidence",
    "",
    "| Item | Value |",
    "| ---- | ----- |",
    ...rows.map(([label, cell]) => `| ${label} | ${cell} |`),
    ""
  ].join("\n");
}

const format = args.format === "json" ? "json" : "md";
const body =
  format === "json" ? `${JSON.stringify(evidence, undefined, 2)}\n` : renderMarkdown(evidence);

const output = typeof args.output === "string" ? resolve(args.output) : undefined;
if (output === undefined) process.stdout.write(body);
else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, body, "utf8");
  process.stdout.write(`${output}\n`);
}
