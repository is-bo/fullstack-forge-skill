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

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

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

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing public commitments, support policy, or legal statements

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Follow the quick start in a clean directory
- Run link, example, and CLI-help consistency checks

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Documentation cannot substitute for unimplemented behavior

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
