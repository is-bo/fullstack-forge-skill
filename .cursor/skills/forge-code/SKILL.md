---
name: forge-code
description: Find correctness, maintainability, type-safety, error-handling, and dead-code risks in changed and critical paths. Use for source changes.
---

# forge-code: Code quality

## Purpose

Find correctness, maintainability, type-safety, error-handling, and dead-code risks in changed and critical paths.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-code`, asks about code quality, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Source changes
- Release readiness
- Refactoring

## When it does not apply

- Repositories containing only non-executable documentation

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- project profile
- changed-file set
- formatter, linter, and typecheck commands

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything.
2. State an applicability decision and the evidence supporting it.
3. Trace at least one critical flow end to end; do not infer downstream enforcement from a UI or
   declaration alone.
4. Run the safe executable checks below. Capture command, exit code, relevant output, and time.
5. Perform the manual inspections. Mark unavailable runtime or operator evidence `NOT_VERIFIED`.
6. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location.
7. In `fix` mode, separate safe fixes from approval-required changes before editing.
8. In `verify` mode, reproduce the original condition, run the stated verification, and update
   status without erasing earlier evidence.

### Concrete checks

- Run available format, lint, type, unit, and build checks without hiding failures
- Inspect boundary validation, error propagation, resource cleanup, concurrency, and unsafe casts
- Compare changes with the newest established local precedent and remove only proven dead code

## Safe executable checks

- Run `forge code audit --json` or `fullstack-forge code audit --json` when
  the CLI is installed.
- Use `inspect-code` when present in the complete bundle; otherwise record it as unavailable, not
  successful.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review complex control flow and public API clarity
- Inspect generated or excluded paths not covered by tools

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-CODE-001`, `FF-CODE-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- Apply deterministic formatting
- Correct proven lint, typing, cleanup, and assertion defects

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing a public contract or broad behavior during cleanup

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run gates after the final edit
- Exercise the affected behavior rather than relying only on compilation

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- NIST SSDF
- language-specific style guidance

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use the repository's pinned toolchain and scripts

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Static analysis cannot prove runtime behavior or requirement intent

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
