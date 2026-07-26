# Release notes — v0.5.2

Fullstack Forge v0.5.2 fixes repository audits that aborted when generated or binary material
exceeded the old 128 MiB filesystem-size budget.

## Repository inventory

- Git-aware candidate discovery includes tracked and relevant untracked files while respecting Git
  ignore configuration; a bounded non-Git fallback remains available.
- Shared categorized exclusions cover Forge-private state, dependencies, generated output, caches,
  local environments, runtime data, and temporary data.
- Relevant-text bytes are charged only after path, metadata, extension, relevance, and binary
  classification.
- `.forgeignore`, repeatable `--exclude`, and strict capped `--inspection-budget` are documented and
  visible in JSON/report evidence.
- Partial required evidence produces `FF-INVENTORY-001`, `NOT_VERIFIED`, and exit code `2` instead
  of a generic crash or false pass.
- Working-tree revisions no longer read every untracked file or buffer binary diffs; incomplete
  dirty state is explicit.

## Agent and platform behavior

The canonical Forge skills now perform bounded root/Git/manifest discovery before broad audit
routing. Generated copies for Codex, Claude Code, Cursor, Gemini, Antigravity, Windsurf, GitHub
Copilot, and generic Agent Skills remain synchronized.

## Install

After the immutable v0.5.2 tag exists:

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.5.2
npx forge init
npx forge doctor
```

Remote CI, tagging, publication, provenance, immutability, and post-publication installation remain
pending until their authorized workflows run.
