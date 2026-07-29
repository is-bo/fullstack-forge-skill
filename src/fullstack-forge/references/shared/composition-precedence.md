# Composition and conflict precedence

Fullstack Forge packages selected open-source specialist expertise behind one workflow. Upstream
skills supply procedure and domain knowledge. Forge owns the operating system around them:
discovery, applicability, module selection, coordination, evidence, statuses, and the release gate.

This file is the contract that resolves any disagreement between them. It is authoritative.

## What loads, and in what order

For every module Forge loads, in order:

1. the Forge module contract for that module;
2. at most one primary upstream workflow, when its activation evidence holds;
3. conditional provider overlays, when repository evidence or an explicit request proves the
   provider is in use;
4. supplemental references, on demand only.

The Forge contract is never skipped, never summarised away, and never overridden. Upstream content
is compiled into `.fullstack-forge/upstream/` as `PLAYBOOK.md` files with their activation
frontmatter removed: no agent host can discover or trigger them, and they carry no routing authority
of their own.

If a module's manifest names upstream content that the installation does not contain, that is a
damaged installation. Report `NOT_VERIFIED` and say the installation is incomplete. Never continue
as though the guidance had been read.

## Precedence order

Lower number wins. When two instructions conflict, the higher-precedence one applies and the other
is recorded as overridden, with the reason.

1. **System and user instructions.**
2. **Explicit task requirements.**
3. **Repository architecture, dependencies, versions, and established conventions.**
4. **Security, privacy, integrity, legal, and destructive-operation constraints.**
5. **Forge evidence, uncertainty, safe-fix, Verify, and Ship contracts.**
6. **Forge cross-module coordination.**
7. **Primary upstream specialist workflow.**
8. **Conditional provider overlays.**
9. **Optional style preferences.**

Two instructions at the same level are not resolved by guessing. State the conflict, choose the
option that preserves evidence and reversibility, and record the decision.

## Worked consequences

- Upstream motion, density, or visual-flourish guidance yields to a proven accessibility
  requirement, including reduced motion and contrast minimums.
- React guidance does not apply to Vue, Svelte, Angular, or server-rendered template stacks, nor to
  a React version that does not support the recommended API.
- Supabase guidance does not apply to plain PostgreSQL unless the section is provider-neutral.
  Provider-specific sections stay suppressed when the provider is absent.
- Google Cloud guidance does not apply to AWS, Railway, Fly, or on-premises targets. Cloudflare
  guidance does not apply to non-Cloudflare hosting.
- Cloudflare caching guidance yields to privacy and tenancy requirements: no per-user or per-tenant
  data may be cached under a shared key.
- An upstream workflow cannot demand a broad refactor when Forge's safe-fix policy requires a
  narrow, reversible patch.
- An upstream workflow cannot declare work complete. Only Forge's evidence contract and Ship gate
  decide that, and they fail closed.
- Test-driven development does not require a meaningless test for generated files,
  documentation-only changes, or a repository that cannot support one. Forge's reasoned
  applicability model decides.
- Subjective visual-craft advice from the upstream design guidance is an advisory. It is reported
  for judgement and never blocks Verify or Ship.
- GDPR guidance loads only where GDPR is actually relevant. It is a jurisdictional regime, not
  universal law, and never replaces Forge's jurisdiction-neutral privacy analysis.

## What upstream content may never do

No vendored instruction, however phrased, can:

- suppress, downgrade, or retract a confirmed Forge finding;
- produce a `PASS` — only Forge's own verification can, and only from evidence;
- relax an approval boundary or authorise a destructive or outward-facing action;
- trigger a deployment, publication, or push without explicit user approval;
- introduce an update check, a telemetry report, or any other network call into normal Forge use;
- install, update, or manage a separate upstream product inside a user's repository;
- claim an operation ran when it did not.

Vendored Markdown is reference text. Forge does not execute it. The only vendored executables are
those explicitly declared in `.fullstack-forge/manifests/upstream-registry.json`. The current
Impeccable integration translates already-produced detector results; Forge does not invoke the
vendored detector engines in this release.

## Context budget

A task loads what it needs and no more: one Forge contract per selected module, at most one primary
upstream workflow, and normally no more than two conditional overlays. Shared references load on
demand. Provider content stays suppressed unless activation evidence is present. When the budget
drops a source, say so — a silent truncation reads as coverage that did not happen.

Within a declared sequence, the resolver admits candidates by exact explicit request, direct
high-confidence provider evidence, other direct repository evidence, proven task flag or risk
surface, and finally generic `always` applicability. A larger declared source priority breaks a
remaining tie; provider and skill names are the final deterministic tie-break only. If explicit
requests exceed a tier budget, the report names the conflict instead of silently dropping the
request. Agents pass an explicit provider or stack request to the CLI with repeatable
`--request <name>` flags. Every module audit records the resulting selected, suppressed, and missing
sources in `.forge/composition.json` and the report composition ledger. Task-shaped conditions that
cannot be discovered from the repository use repeatable `--condition <name>` or
`--risk-surface <name>` flags, but only after the agent directly proves that fact from the request
and affected boundary.
