---
name: forge-docs
description: Verify that user, contributor, architecture, operations, security, and release documentation is accurate and executable. Activate automatically for every maintained or distributed project when that concern is relevant to a software-engineering request.
---

# forge-docs: Documentation

## Purpose

Verify that user, contributor, architecture, operations, security, and release documentation is accurate and executable.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves documentation, when
the user explicitly names `forge-docs`, or when discovery proves an applicable boundary.

- Every maintained or distributed project

## When not to activate

- No exemption; scope follows the artifact's audience

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- documentation tree
- CLI help
- configuration and workflows

Available deterministic support, where present:

- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Execute the README setup path in a clean environment and record where it breaks or diverges from reality.
3. Verify every documented command, environment variable, and configuration key against the current code.
4. Check operational documentation: deployment, migration, backup restoration, and incident procedures for executability.
5. Trace critical business rules and the permission model to written documentation, and record decisions that exist only in code or chat.
6. Sweep for broken links, stale screenshots, and outdated version references.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review information hierarchy for each audience
- Check that limitations and human-only steps are conspicuous

Stack-specific guidance:

- Generate reference material from the same command and schema sources when practical

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- Diátaxis concepts
- CommonMark
- WCAG 2.2

## Common production failures

- Run installation, quick-start, command, configuration, troubleshooting, and contribution steps from a clean context
- Check architecture, data, security, deployment, recovery, compatibility, ownership, and release notes against current code
- Validate links, examples, diagrams, generated references, accessibility, and secret-free sample values

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Correct stale commands, links, examples, and diagrams
- Add missing evidence-backed operational notes

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing public commitments, support policy, or legal statements

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Follow the quick start in a clean directory
- Run link, example, and CLI-help consistency checks

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Documentation cannot substitute for unimplemented behavior

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
