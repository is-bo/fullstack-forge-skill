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
 * are kept byte-identical by `cli/tests/managed-layout.test.ts`.
 */
export declare const CANONICAL_ROOT_SEGMENTS: readonly [".fullstack-forge", "skills"];
export declare const CANONICAL_ROOT_POSIX: string;
export declare const ADAPTER_MARKER = "fullstack-forge:managed-adapter";
export declare const ADAPTER_SCHEMA_VERSION = 1;
export declare function isVerbatimHostFile(relativePath: string): boolean;
/** Relative pointer from `<hostSkillsRoot>/<skill>/SKILL.md` to the canonical playbook. */
export declare function adapterPointer(hostSkillsRootPosix: string, skill: string): string;
/** Extracts the raw YAML frontmatter block (without the `---` fences) from a SKILL.md. */
export declare function extractFrontmatter(text: string, label: string): string;
/**
 * Renders a host adapter. Deterministic in (skill, pointer, frontmatter) so re-running installation
 * produces identical bytes and therefore idempotent `preserve-identical` actions.
 */
export declare function renderAdapter(input: {
    skill: string;
    pointer: string;
    frontmatter: string;
}): string;
/** True when `text` is a Forge-generated adapter rather than a full canonical playbook. */
export declare function isAdapter(text: string): boolean;
export type AdapterMarker = {
    version: number;
    skill: string;
    canonical: string;
};
/** Parses the adapter marker so `forge doctor` can distinguish adapters from canonical content. */
export declare function readAdapterMarker(text: string): AdapterMarker | undefined;
