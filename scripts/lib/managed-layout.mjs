// Canonical managed-content layout shared by the asset generator, the packager, and the installer.
//
// One canonical copy of every managed skill file lives under `.fullstack-forge/skills/`. Each agent
// host keeps only a thin adapter `SKILL.md` per skill: the canonical YAML frontmatter verbatim (so
// host discovery and automatic triggering are unchanged) plus a short body that points the agent at
// the canonical playbook. Adapters are plain regular files; no symlink, junction, or reparse point
// is ever created or required.
//
// `cli/src/managed-layout.ts` mirrors this module for the installed-project side. The two are kept
// byte-identical by `cli/tests/managed-layout.test.ts`, which renders the same inputs through both.

export const CANONICAL_ROOT_SEGMENTS = Object.freeze([".fullstack-forge", "skills"]);
export const CANONICAL_ROOT_POSIX = CANONICAL_ROOT_SEGMENTS.join("/");
export const ADAPTER_MARKER = "fullstack-forge:managed-adapter";
export const ADAPTER_SCHEMA_VERSION = 1;

/**
 * Hosts that genuinely require a byte-for-byte copy of some canonical files instead of a pointer.
 *
 * Codex and Antigravity read host metadata with ordinary tooling, not with an agent that can follow
 * a prose pointer, and that metadata declares `./assets/fullstack-forge-icon.png` relative to
 * itself. Those two directories are therefore copied verbatim into their host trees. Every other
 * host consumes only `SKILL.md`, so every other host gets adapters alone.
 */
export const VERBATIM_HOST_IDS = Object.freeze(["agents", "antigravity"]);
const VERBATIM_PATTERN = /^[^/]+\/(agents|assets)\//u;

export function isVerbatimHostFile(relativePath) {
  return VERBATIM_PATTERN.test(relativePath);
}

export function hostVerbatimPaths(hostId, canonicalPaths) {
  if (!VERBATIM_HOST_IDS.includes(hostId)) return [];
  return [...canonicalPaths].filter((rel) => isVerbatimHostFile(rel)).sort();
}

/** Skill directory names in a canonical file map: every top-level directory holding a SKILL.md. */
export function skillNames(canonicalPaths) {
  const names = new Set();
  for (const rel of canonicalPaths) {
    const parts = rel.split("/");
    if (parts.length === 2 && parts[1] === "SKILL.md" && parts[0] !== "") names.add(parts[0]);
  }
  return [...names].sort();
}

/**
 * Relative pointer from `<hostSkillsRoot>/<skill>/SKILL.md` to the canonical playbook. Both roots
 * are POSIX paths relative to the same installation root, so the pointer never escapes that root.
 */
export function adapterPointer(hostSkillsRootPosix, skill) {
  const segments = hostSkillsRootPosix.split("/").filter(Boolean);
  if (segments.length === 0) throw new Error("Host skills root must not be empty");
  const ups = "../".repeat(segments.length + 1);
  return `${ups}${CANONICAL_ROOT_POSIX}/${skill}/SKILL.md`;
}

/** Extracts the raw YAML frontmatter block (without the `---` fences) from a SKILL.md. */
export function extractFrontmatter(text, label) {
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
 * Renders a host adapter. Deterministic in (skill, pointer, frontmatter) so re-running generation
 * or installation produces identical bytes and therefore idempotent no-op actions.
 */
export function renderAdapter({ skill, pointer, frontmatter }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(skill))
    throw new Error(`Unsafe managed skill name: ${skill}`);
  if (!pointer.startsWith("../") || pointer.includes("//"))
    throw new Error(`Unsafe adapter pointer for ${skill}: ${pointer}`);
  const module = skill.startsWith("forge-") ? skill.slice("forge-".length) : undefined;
  const runnerPointer = `${pointer.slice(0, pointer.indexOf(CANONICAL_ROOT_POSIX))}.fullstack-forge/runtime/cli/src/composition-entry.js`;
  const composition =
    module === undefined || ["all", "discover", "ship"].includes(module)
      ? []
      : [
          "",
          "**Resolve the runtime composition before loading specialist guidance:**",
          "",
          `\`node ${runnerPointer} ${module} compose --root <repository-root> --json\``,
          "",
          "Pass repeatable `--request`, `--condition`, or `--risk-surface` values only for",
          "explicit requests and directly proven task facts.",
          "",
          "Then load only the ordered `selected` paths in `.forge/composition.json`. Stop and",
          "report the installation as damaged if `missing` is non-empty; suppressed sources are not",
          "fallback instructions."
        ];
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
    ...composition,
    "",
    "Do not edit this adapter; edit the canonical playbook instead. If the canonical file is",
    "missing or unreadable the installation is damaged: run `forge doctor`, then `forge update all`.",
    ""
  ].join("\n");
}

/** True when `text` is a Forge-generated adapter rather than a full canonical playbook. */
export function isAdapter(text) {
  return text.includes(`<!-- ${ADAPTER_MARKER} v`);
}

/** Parses the adapter marker so `forge doctor` can distinguish adapters from canonical content. */
export function readAdapterMarker(text) {
  const match = new RegExp(
    `<!-- ${ADAPTER_MARKER} v(\\d+) skill=([^\\s]+) canonical=([^\\s]+) -->`,
    "u"
  ).exec(text);
  if (match === null) return undefined;
  return { version: Number(match[1]), skill: match[2], canonical: match[3] };
}
