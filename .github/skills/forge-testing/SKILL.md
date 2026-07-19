---
name: forge-testing
description: Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes. Use for executable software.
---

# forge-testing: Testing strategy

## Purpose

Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-testing`, asks about testing strategy, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Executable software
- Release readiness

## When it does not apply

- Non-executable documentation-only packages

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- test manifests and commands
- coverage configuration
- critical workflow inventory

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Map the test pyramid: what exists at unit, integration, API, end-to-end, and evaluation level, and what each layer actually asserts.
3. Trace the riskiest workflows from discovery to their covering tests; record critical paths with no failure-path or authorization test.
4. Inspect test quality: assertions that prove behavior versus existence, mock realism, isolation, and determinism (hunt flaky patterns).
5. Verify negative coverage: unauthorized access, invalid input, concurrency, retries, and idempotency for the paths that claim them.
6. Run the suite and record counts, duration, skips, and any tests that cannot fail.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

- Map critical risks to unit, integration, contract, end-to-end, migration, security, and accessibility tests
- Inspect determinism, isolation, data factories, assertions, cleanup, time control, concurrency, and flaky retries
- Verify tests can fail for the defect they claim to detect and do not overmock the boundary under test

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Unit tests
- Integration tests
- API tests
- Database tests
- Authorization tests
- Tenant-isolation tests
- Upload tests
- Malware-pipeline tests
- End-to-end tests
- Accessibility tests
- Visual-regression tests
- Migration tests
- Failure-path tests
- Retry tests
- Idempotency tests
- Concurrency tests
- Offline tests
- Payment tests
- AI evaluation tests
- Test isolation
- Flaky tests
- Mock quality
- Critical workflow coverage
- Production-like test configuration
- Risk-based adequacy rather than line coverage alone

## Safe executable checks

- Run `forge testing audit --json` or `fullstack-forge testing audit --json` when
  the CLI is installed.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review omitted high-impact scenarios and test maintainability
- Inspect CI artifacts and quarantine policy

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-TEST-001`, `FF-TEST-002`, and so on. Preserve an ID across
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

- Add missing assertions and deterministic setup
- Remove an unnecessary retry only after proving the test is stable

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Deleting coverage, weakening assertions, or changing product behavior to satisfy tests

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run targeted tests before and after inducing a representative failure
- Run the relevant full suite after final edits

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- NIST SSDF
- testing-pyramid and contract-testing concepts

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use native test isolation and real boundary substitutes such as ephemeral databases where practical

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Coverage percentage alone does not establish behavior coverage

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
