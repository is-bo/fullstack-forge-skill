---
name: forge-docs
description: "Verify that user, contributor, architecture, operations, security, and release documentation is accurate and executable."
---

# forge-docs: Documentation

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Verify that user, contributor, architecture, operations, security, and release documentation is accurate and executable.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" docs compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves documentation, when
the user explicitly names `forge-docs`, or when discovery proves an applicable boundary.

- Every maintained or distributed project

## When not to activate

- No exemption; scope follows the artifact's audience

## Automated support

Relevant discovery inputs are:

- documentation tree
- CLI help
- configuration and workflows

Deterministic support, bounded evidence only:

- None; use detected project commands and direct manual evidence.

## Agent inspection procedure

1. Execute the README setup path in a clean environment and record where it breaks or diverges from reality.
2. Verify every documented command, environment variable, and configuration key against the current code.
3. Check operational documentation: deployment, migration, backup restoration, and incident procedures for executability.
4. Trace critical business rules and the permission model to written documentation, and record decisions that exist only in code or chat.
5. Sweep for broken links, stale screenshots, and outdated version references.

Manual inspection requirements:

- Review information hierarchy for each audience
- Check that limitations and human-only steps are conspicuous

Stack-specific guidance:

- Generate reference material from the same command and schema sources when practical

## Evidence to collect

Standards used as criteria:

- Diátaxis concepts
- CommonMark
- WCAG 2.2

## Common production failures

- Run installation, quick-start, command, configuration, troubleshooting, and contribution steps from a clean context
- Check architecture, data, security, deployment, recovery, compatibility, ownership, and release notes against current code
- Validate links, examples, diagrams, generated references, accessibility, and secret-free sample values

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- README accuracy
- Installation
- Local setup
- Environment variables
- Architecture
- API documentation
- Database diagrams
- Migration instructions
- Deployment instructions
- Troubleshooting
- Backup restoration
- Incident procedures
- Permission model
- Business-critical calculations
- Onboarding
- Outdated comments
- Broken links
- Decisions existing only in chat or undocumented knowledge

## Commands and tools

- Run `forge docs audit --json` or `fullstack-forge docs audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Correct stale commands, links, examples, and diagrams
- Add missing evidence-backed operational notes

## Approval-required changes

- Changing public commitments, support policy, or legal statements

## Verification

- Follow the quick start in a clean directory
- Run link, example, and CLI-help consistency checks

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Documentation cannot substitute for unimplemented behavior
