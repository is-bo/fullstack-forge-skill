# Product layer design — v0.5.1

## Decision

Keep two distinct Codex-visible skills:

- **Forge** — the recommended beginner router with the preview **Build · Audit · Fix · Verify · Ship
  · Status**.
- **Fullstack Forge — Expert Audit** — the backward-compatible advanced audit orchestrator.

The official Codex skill metadata surface is `agents/openai.yaml`. The supported interface fields
used here are `display_name`, `short_description`, `icon_small`, `icon_large`, `brand_color`, and
`default_prompt`; no policy or dependency field is needed.

## Canonical generation

`config/build-commands.json` remains the canonical source for the generated `forge/SKILL.md`.
`src/fullstack-forge/commands/forge/agents/openai.yaml` is the canonical router metadata. The main
Forge icon remains canonical under `src/fullstack-forge/assets/`; `generate-build.mjs` copies it
into the router skill, and platform synchronization recursively owns the Build-command files.

All six generated roots receive byte-identical skill metadata and assets under the repository's
existing `agents/openai.yaml` packaging convention. Per-file hashes, unknown-file refusal,
path-containment checks, symlink refusal, and modified-owned-file refusal remain in force.

## No-action behavior

Selecting Forge without an action presents ten choices:

1. Build
2. Continue
3. Audit changed work
4. Audit the whole project
5. Fix — preview safe fixes
6. Fix — apply safe fixes
7. Verify
8. Ship
9. Status
10. Help

Rendering this menu is read-only. It does not run an audit, create Build state, write a report,
claim that a check ran, or print the advanced command grammar.

## Routing and compatibility

The router maps ordinary language to the existing Build, Audit, Fix, Verify, Ship, Status, and Help
workflows. Explicit conjunctions route to each named specialist. A compact ambiguous area such as
`data` offers analytics, database, privacy, queries, and storage rather than guessing.

`$fullstack-forge`, `$forge-security`, `$forge-ui`, `$forge-database`, `$forge-feature`,
`$forge-new`, and every other expert skill remain present. The patch changes no public schema,
finding identifier, evidence contract, installer selector, module slug, or CLI command contract.

## Safety invariants

- No evidence producer or alternate route to `PASS`.
- No implicit `--safe` or `--allow-run`.
- No project script, server, browser, publication, or deployment is started by menu selection.
- Build evidence still satisfies no Audit or Ship gate.
- Missing evidence remains `NOT_VERIFIED` or `BLOCKED`.
- Risky, policy-bearing, destructive, identity, tenant, payment, and data changes remain
  approval-bound.
