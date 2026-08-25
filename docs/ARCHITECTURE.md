# Architecture

Fullstack Forge is an agent-first engineering system, not a universal scanner.

## Responsibility boundaries

- The AI agent understands intent, inspects the project, selects playbooks, reasons about design,
  implements code, adds tests, verifies behavior, and reports uncertainty.
- Forge skills provide applicability signals, production failure patterns, inspection and
  implementation procedures, safe-change boundaries, evidence rules, and completion contracts.
- The Forge CLI provides bounded inventory, discovery, deterministic analyzers where supported,
  command evidence, findings/reports, revision tracking, Build state, safe fixes, Verify/Ship gates,
  and platform installation.
- Project-native tools provide runtime-specific evidence.

## Canonical and generated assets

`src/fullstack-forge/` is the only authored skill source. `npm run generate` renders 42 specialist
playbooks, three product/Build skills, 42 Build briefs, and the installed canonical tree under
`.fullstack-forge/skills/`. Host discovery roots under `.agents/`, `.claude/`, `.cursor/`,
`.gemini/`, `.github/skills/`, and `.windsurf/`, plus the package-local Codex plugin `skills/` root,
contain generated thin adapters rather than duplicate playbooks. Each adapter resolves its canonical
file relative to its own directory, and package/archive checks exercise those pointers in a clean
target. Generated ownership manifests prevent clobbering local edits.

Reviewed upstream expertise is compiled separately under `.fullstack-forge/upstream/` as inert
`PLAYBOOK.md` content. It is outside every host discovery root and is reachable only through the
composition registry. This keeps provider activation, context budgets, precedence, and evidence
authority in Forge rather than allowing vendored frontmatter to self-activate.

## Default feature flow

```text
UNDERSTAND → DISCOVER → SELECT → PLAN → IMPLEMENT → INSPECT → VERIFY → REPORT
```

The installed project instruction activates this flow. Direct repository evidence controls module
selection; generated Forge content, fixtures, examples, and dependency names are not final
capability evidence.

The always-loaded `fullstack-forge/SKILL.md` is a concise router and operating contract. It loads
workflow details progressively: Audit for formal inspection, Fix for finding remediation, Verify for
retests, Report for formal findings, Build for substantial recorded features, and Ship only for
release gating. A small change does not load those full workflows merely because automatic
activation occurred. Shared evidence, safe-fix, and applicability-aware completion policies each
have one canonical owner under `src/fullstack-forge/references/`.

## Coverage modes

- `light`: small low-risk edits with focused evidence.
- `standard`: normal features with relevant modules, tests, and a final relevant pass.
- `high`: sensitive boundaries with stronger evidence and approval requirements.
- explicit Audit/Ship: user- or CI-requested inspection and release gates.

Build evidence and historical reports never satisfy Ship. Current, root- and revision-bound evidence
is required at each enforcement boundary.

Applicability keeps four independent facts: bounded risk status, control status, module
applicability, and executable analyzer support. Risk selects work; a missing control never makes the
risk disappear. An unknown relevant risk remains selected as `APPLICABLE_UNPROVEN`, while
`NOT_APPLICABLE` requires bounded evidence that the surface is absent. Audit and Ship call the same
application-inspection pipeline, so identical source and scope produce identical analyzer finding
identities; Ship adds its independent release gates around that shared evidence.

## Frontend experience system

`forge-frontend` is the sole interface-work orchestrator. It composes `forge-ui`, `forge-ux`, and
`forge-accessibility`, then selects i18n, SEO, performance, offline, or security owners from request
and repository evidence. Fourteen single-concern references under
`src/fullstack-forge/references/frontend/` provide progressive product, visual, system, responsive,
component, framework, performance, motion, forms, data, mobile, review, and anti-pattern guidance.
Each reference declares when it must and must not be loaded.

Natural-language activation lives in `cli/src/frontend-routing.ts`; generated skill disclosure lives
in `config/frontend-system.json`. Routing combines explicit intent, application type, affected
paths, workspace/framework evidence, project profile, changed files, strong interface terms, and
backend-only evidence. Ambiguous words such as `page`, `table`, `form`, `component`, `layout`, and
`state` require supporting evidence. The selection is deterministic but never claims inspection
occurred. A validator keeps reference ownership, orchestrator size, scenario coverage, and
shared-policy duplication bounded. Detailed accessibility, localization, search, performance, and
offline rules remain in their existing modules to prevent competing sources of truth.

## Installation ownership

The project manifest records installed files, platform, digest, ownership, file/section management,
package version, `agent_first`, and `automatic_activation`. Section-managed root instructions allow
user content outside the Forge markers to change safely. Symlinked destinations and path escapes are
refused. A selector-free `forge init` installs only hosts supported by finite project, user, or PATH
markers and falls back to generic Agent Skills when none are detected. `forge init all` remains an
explicit compatibility choice; `forge update all` safely upgrades older all-platform manifests.
