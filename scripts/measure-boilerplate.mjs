#!/usr/bin/env node
/**
 * Deterministic shared-boilerplate measurement for the Fullstack Forge module playbooks.
 *
 * METHOD — this header is the normative description of the metric.
 *
 * 1. Corpus. The `modules` corpus is the 42 canonical specialist playbooks at
 *    `src/fullstack-forge/commands/forge-<slug>/SKILL.md`, in `config/modules.json` order.
 *    The `playbooks` corpus additionally includes the 42 per-module build briefs at
 *    `src/fullstack-forge/references/build/<slug>.md`.
 *
 * 2. Units. Each file is split into semantic units rather than raw lines, so that re-wrapping
 *    prose cannot change the score. A unit is one of: a YAML frontmatter entry, a heading,
 *    a single list item (including its indented continuation lines), or a paragraph
 *    (consecutive non-blank, non-list, non-heading lines joined together).
 *
 * 3. Normalization. Unit text is lowercased, list markers / ordered-list numbering are removed,
 *    and all whitespace runs collapse to a single space. Normalization is idempotent and
 *    independent of line wrapping.
 *
 * 4. Sharing. A normalized unit is SHARED BOILERPLATE when it occurs in at least
 *    `--threshold` (default 3) DISTINCT files of the corpus.
 *
 * 5. Score. Units are weighted by token count (whitespace-separated words of the normalized
 *    text), and every occurrence is weighted. The reported percentage is
 *       sharedTokens / totalTokens * 100
 *    i.e. "what share of the words an agent reads across all module playbooks is text it has
 *    already read in two or more other modules".
 *
 * A secondary, wrapping-independent cross-check is also reported: the share of distinct
 * `--shingle` (default 8) word n-grams whose occurrences span >= threshold distinct files,
 * weighted by occurrence count.
 *
 * Usage:
 *   node scripts/measure-boilerplate.mjs
 *   node scripts/measure-boilerplate.mjs --json
 *   node scripts/measure-boilerplate.mjs --corpus playbooks --threshold 3 --top 25
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expectedSlugs, canonicalRoot, projectRoot, readCatalog } from "./project.mjs";

export const DEFAULT_THRESHOLD = 3;
export const DEFAULT_SHINGLE = 8;

/** Corpus definitions. Order is deterministic (config/modules.json order). */
export function corpusFiles(corpus = "modules") {
  const modules = expectedSlugs.map((slug) => ({
    slug,
    id: `commands/forge-${slug}/SKILL.md`,
    path: join(canonicalRoot, "commands", `forge-${slug}`, "SKILL.md")
  }));
  if (corpus === "modules") return modules;
  if (corpus === "playbooks") {
    return [
      ...modules,
      ...expectedSlugs.map((slug) => ({
        slug,
        id: `references/build/${slug}.md`,
        path: join(canonicalRoot, "references", "build", `${slug}.md`)
      }))
    ];
  }
  throw new Error(`Unknown corpus: ${corpus}`);
}

/** Collapse whitespace, drop list markers, lowercase. Idempotent. */
export function normalizeUnit(text) {
  return text
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^(?:[-*+]\s+|\d+[.)]\s+)/u, "")
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Replace a module's own identity (slug, `forge-<slug>` name, and human title) with a fixed
 * placeholder so that TEMPLATED text differing only by module name is recognised as shared.
 * Applied to already-normalized (lowercased, whitespace-collapsed) unit text.
 */
export function maskModuleIdentity(normalized, slug, title) {
  const lowerTitle = title.toLowerCase();
  const patterns = [
    `fullstack-forge ${escapeRegExp(slug)}`,
    `forge-${escapeRegExp(slug)}`,
    `forge ${escapeRegExp(slug)}`,
    escapeRegExp(lowerTitle)
  ];
  let masked = normalized;
  for (const pattern of patterns)
    masked = masked.replace(new RegExp(`(?<![\\w-])${pattern}(?![\\w-])`, "gu"), "<module>");
  return masked;
}

function isHeading(line) {
  return /^#{1,6}\s/u.test(line);
}

function isListItem(line) {
  return /^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/u.test(line);
}

/**
 * Split markdown into normalized semantic units. Fenced code blocks are kept intact as
 * single units so that indentation inside them cannot be mistaken for list continuation.
 */
export function extractUnits(source) {
  const text = source.replace(/\r\n/gu, "\n");
  const lines = text.split("\n");
  const units = [];
  let buffer = [];
  let inFence = false;
  let inFrontmatter = false;

  const flush = () => {
    if (buffer.length === 0) return;
    const normalized = normalizeUnit(buffer.join(" "));
    if (normalized.length > 0) units.push(normalized);
    buffer = [];
  };

  for (const [index, line] of lines.entries()) {
    if (index === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") {
        inFrontmatter = false;
        continue;
      }
      // Each frontmatter entry is its own unit.
      const normalized = normalizeUnit(line);
      if (normalized.length > 0) units.push(normalized);
      continue;
    }
    if (/^\s*```/u.test(line)) {
      if (!inFence) flush();
      inFence = !inFence;
      buffer.push(line.trim());
      if (!inFence) flush();
      continue;
    }
    if (inFence) {
      buffer.push(line.trim());
      continue;
    }
    if (line.trim().length === 0) {
      flush();
      continue;
    }
    if (isHeading(line)) {
      flush();
      units.push(normalizeUnit(line));
      continue;
    }
    if (isListItem(line)) {
      flush();
      buffer.push(line.trim());
      continue;
    }
    buffer.push(line.trim());
  }
  flush();
  return units;
}

function tokenCount(normalized) {
  if (normalized.length === 0) return 0;
  return normalized.split(" ").filter((token) => token.length > 0).length;
}

export function shingles(units, size) {
  const words = units.join(" ").split(" ").filter(Boolean);
  const out = [];
  for (let index = 0; index + size <= words.length; index += 1)
    out.push(words.slice(index, index + size).join(" "));
  return out;
}

export async function measure({
  corpus = "modules",
  threshold = DEFAULT_THRESHOLD,
  shingle = DEFAULT_SHINGLE
} = {}) {
  const catalog = await readCatalog();
  const titleBySlug = new Map(catalog.map((module) => [module.slug, module.title]));
  const files = corpusFiles(corpus);
  const perFile = [];
  for (const file of files) {
    const source = await readFile(file.path, "utf8");
    const units = extractUnits(source);
    const title = titleBySlug.get(file.slug) ?? file.slug;
    perFile.push({
      ...file,
      units,
      maskedUnits: units.map((unit) => maskModuleIdentity(unit, file.slug, title))
    });
  }

  // --- primary: unit-level sharing -------------------------------------------------
  const fileCountByUnit = new Map();
  for (const file of perFile)
    for (const unit of new Set(file.units))
      fileCountByUnit.set(unit, (fileCountByUnit.get(unit) ?? 0) + 1);

  const fileCountByMasked = new Map();
  for (const file of perFile)
    for (const unit of new Set(file.maskedUnits))
      fileCountByMasked.set(unit, (fileCountByMasked.get(unit) ?? 0) + 1);

  let totalTokens = 0;
  let sharedTokens = 0;
  let maskedSharedTokens = 0;
  const sharedWeight = new Map();
  const maskedSharedWeight = new Map();
  const fileScores = [];
  for (const file of perFile) {
    let fileTotal = 0;
    let fileShared = 0;
    let fileMaskedShared = 0;
    for (const [index, unit] of file.units.entries()) {
      const weight = tokenCount(unit);
      fileTotal += weight;
      if ((fileCountByUnit.get(unit) ?? 0) >= threshold) {
        fileShared += weight;
        sharedWeight.set(unit, (sharedWeight.get(unit) ?? 0) + weight);
      }
      const masked = file.maskedUnits[index];
      if ((fileCountByMasked.get(masked) ?? 0) >= threshold) {
        fileMaskedShared += weight;
        maskedSharedWeight.set(masked, (maskedSharedWeight.get(masked) ?? 0) + weight);
      }
    }
    totalTokens += fileTotal;
    sharedTokens += fileShared;
    maskedSharedTokens += fileMaskedShared;
    fileScores.push({
      id: file.id,
      totalTokens: fileTotal,
      sharedTokens: fileShared,
      percent: fileTotal === 0 ? 0 : round((fileShared / fileTotal) * 100),
      maskedPercent: fileTotal === 0 ? 0 : round((fileMaskedShared / fileTotal) * 100)
    });
  }

  // --- secondary: shingle-level sharing ---------------------------------------------
  const shingleFileCount = new Map();
  const perFileShingles = perFile.map((file) => shingles(file.units, shingle));
  for (const list of perFileShingles)
    for (const gram of new Set(list))
      shingleFileCount.set(gram, (shingleFileCount.get(gram) ?? 0) + 1);
  let shingleTotal = 0;
  let shingleShared = 0;
  for (const list of perFileShingles)
    for (const gram of list) {
      shingleTotal += 1;
      if ((shingleFileCount.get(gram) ?? 0) >= threshold) shingleShared += 1;
    }

  const rank = (weights, counts) =>
    [...weights.entries()]
      .map(([unit, weight]) => ({
        unit,
        files: counts.get(unit) ?? 0,
        tokens: tokenCount(unit),
        weight
      }))
      .sort((a, b) => b.weight - a.weight || (a.unit < b.unit ? -1 : 1));

  return {
    corpus,
    threshold,
    shingle,
    files: files.length,
    totalTokens,
    sharedTokens,
    maskedSharedTokens,
    percent: totalTokens === 0 ? 0 : round((sharedTokens / totalTokens) * 100),
    maskedPercent: totalTokens === 0 ? 0 : round((maskedSharedTokens / totalTokens) * 100),
    shinglePercent: shingleTotal === 0 ? 0 : round((shingleShared / shingleTotal) * 100),
    fileScores,
    topShared: rank(sharedWeight, fileCountByUnit),
    topMaskedShared: rank(maskedSharedWeight, fileCountByMasked)
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function parseArgs(argv) {
  const options = {
    corpus: "modules",
    threshold: DEFAULT_THRESHOLD,
    shingle: DEFAULT_SHINGLE,
    json: false,
    top: 20
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--corpus") options.corpus = argv[(index += 1)];
    else if (arg === "--threshold") options.threshold = Number(argv[(index += 1)]);
    else if (arg === "--shingle") options.shingle = Number(argv[(index += 1)]);
    else if (arg === "--top") options.top = Number(argv[(index += 1)]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  join(process.argv[1]) === join(projectRoot, "scripts", "measure-boilerplate.mjs");

if (invokedDirectly) {
  const options = parseArgs(process.argv.slice(2));
  const result = await measure(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `corpus            ${result.corpus} (${result.files} files)`,
        `threshold         shared when a unit appears in >= ${result.threshold} distinct files`,
        `total tokens      ${result.totalTokens}`,
        `shared tokens     ${result.sharedTokens}`,
        `BOILERPLATE       ${result.percent}%   (primary, literal units)`,
        `masked variant    ${result.maskedPercent}%   (module name/title masked)`,
        `shingle-${result.shingle} check    ${result.shinglePercent}%`,
        "",
        `worst files:`,
        ...[...result.fileScores]
          .sort((a, b) => b.percent - a.percent)
          .slice(0, 5)
          .map((entry) => `  ${entry.percent.toFixed(2)}%  ${entry.id}`),
        "",
        `top shared units by weight (masked):`,
        ...result.topMaskedShared
          .slice(0, options.top)
          .map(
            (entry) =>
              `  ${String(entry.weight).padStart(5)}  x${String(entry.files).padStart(3)}  ${entry.unit.slice(0, 96)}`
          ),
        ""
      ].join("\n")
    );
  }
}
