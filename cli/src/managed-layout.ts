/**
 * Canonical managed-content layout for installed projects.
 *
 * One canonical copy of every managed skill file is installed under `.fullstack-forge/skills/`.
 * Each agent host receives only a thin adapter `SKILL.md` per skill: the canonical YAML
 * frontmatter verbatim (so host discovery and automatic triggering are unchanged) plus a short
 * body that points the agent at the canonical playbook. Adapters are plain regular files; no
 * symlink, junction, or reparse point is ever created or required.
 *
 * `scripts/lib/managed-layout.mjs` mirrors this module for the repository asset generator. The two
 * are kept byte-identical by `cli/tests/managed-layout.test.ts`, which renders the same inputs
 * through both. `cli/tests/host-acceptance.test.ts` then proves the rendered layout resolves from
 * each host's documented discovery root.
 */

export const CANONICAL_ROOT_SEGMENTS = [".fullstack-forge", "skills"] as const;
export const CANONICAL_ROOT_POSIX = CANONICAL_ROOT_SEGMENTS.join("/");
export const ADAPTER_MARKER = "fullstack-forge:managed-adapter";
export const ADAPTER_SCHEMA_VERSION = 1;

/**
 * Hosts that genuinely require byte-for-byte copies of some canonical files instead of a pointer.
 *
 * Codex reads `.agents/skills/<skill>/agents/openai.yaml` with ordinary tooling rather than with an
 * agent that can follow a prose pointer, and that file declares `./assets/fullstack-forge-icon.png`
 * relative to itself. Those two directories are therefore copied verbatim into `.agents` roots.
 * Every other host consumes only `SKILL.md`, so every other host gets adapters alone.
 */
const VERBATIM_PATTERN = /^[^/]+\/(agents|assets)\//u;

export function isVerbatimHostFile(relativePath: string): boolean {
  return VERBATIM_PATTERN.test(relativePath);
}

/** Relative pointer from `<hostSkillsRoot>/<skill>/SKILL.md` to the canonical playbook. */
export function adapterPointer(hostSkillsRootPosix: string, skill: string): string {
  const segments = hostSkillsRootPosix.split("/").filter(Boolean);
  if (segments.length === 0) throw new Error("Host skills root must not be empty");
  const ups = "../".repeat(segments.length + 1);
  return `${ups}${CANONICAL_ROOT_POSIX}/${skill}/SKILL.md`;
}

/** Extracts the raw YAML frontmatter block (without the `---` fences) from a SKILL.md. */
export function extractFrontmatter(text: string, label: string): string {
  const normalized = text.replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n");
  if (!normalized.startsWith("---\n"))
    throw new Error(`Canonical skill ${label} does not begin with YAML frontmatter`);
  const end = normalized.indexOf("\n---\n", 3);
  if (end === -1) throw new Error(`Canonical skill ${label} has an unterminated frontmatter block`);
  const block = normalized.slice(4, end + 1);
  if (!/^name:\s*\S/mu.test(block))
    throw new Error(`Canonical skill ${label} frontmatter has no name field`);
  if (!/^description:\s*\S/mu.test(block))
    throw new Error(`Canonical skill ${label} frontmatter has no description field`);
  return block;
}

/**
 * Renders a host adapter. Deterministic in (skill, pointer, frontmatter) so re-running installation
 * produces identical bytes and therefore idempotent `preserve-identical` actions.
 */
export function renderAdapter(input: {
  skill: string;
  pointer: string;
  frontmatter: string;
}): string {
  const { skill, pointer, frontmatter } = input;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(skill))
    throw new Error(`Unsafe managed skill name: ${skill}`);
  if (!pointer.startsWith("../") || pointer.includes("//"))
    throw new Error(`Unsafe adapter pointer for ${skill}: ${pointer}`);
  return [
    "---",
    frontmatter.replace(/\n$/u, ""),
    "---",
    "",
    `<!-- ${ADAPTER_MARKER} v${ADAPTER_SCHEMA_VERSION} skill=${skill} canonical=${pointer} -->`,
    "",
    `# Fullstack Forge adapter: ${skill}`,
    "",
    "This file is a pointer maintained by Fullstack Forge. It exists so this agent host can",
    "discover and trigger the skill. The full playbook is not duplicated here: one canonical copy",
    "is shared by every installed host.",
    "",
    "**Read the canonical playbook now and follow it exactly:**",
    "",
    `\`${pointer}\``,
    "",
    "That path is relative to this file. From the installation root it is",
    `\`${CANONICAL_ROOT_POSIX}/${skill}/SKILL.md\`. Every resource the playbook references`,
    "(`fullstack-forge/references/...`, `fullstack-forge/schemas/...`,",
    "`fullstack-forge/templates/...`, `fullstack-forge/profiles/...`) resolves relative to",
    `\`${CANONICAL_ROOT_POSIX}/\`.`,
    "The canonical playbook owns any deterministic composition step; perform that step exactly",
    "once. This adapter never adds a second workflow or composition command.",
    "",
    "Do not edit this adapter; edit the canonical playbook instead. If the canonical file is",
    "missing or unreadable the installation is damaged. Report it and repair through the same",
    "project-package, archive, or plugin mechanism that installed this adapter. Never fall back to",
    "an unpinned `npx forge`, which may resolve an unrelated public package.",
    ""
  ].join("\n");
}

/** True when `text` is a Forge-generated adapter rather than a full canonical playbook. */
export function isAdapter(text: string): boolean {
  return text.includes(`<!-- ${ADAPTER_MARKER} v`);
}

export type AdapterMarker = { version: number; skill: string; canonical: string };

/** Parses the adapter marker so `forge doctor` can distinguish adapters from canonical content. */
export function readAdapterMarker(text: string): AdapterMarker | undefined {
  const match = new RegExp(
    `<!-- ${ADAPTER_MARKER} v(\\d+) skill=([^\\s]+) canonical=([^\\s]+) -->`,
    "u"
  ).exec(text);
  if (match === null) return undefined;
  return { version: Number(match[1]), skill: match[2] ?? "", canonical: match[3] ?? "" };
}
