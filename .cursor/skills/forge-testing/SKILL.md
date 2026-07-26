---
name: forge-testing
description: Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes. Activate automatically for executable software when that concern is relevant to a software-engineering request.
---

# forge-testing: Testing strategy

## Purpose

Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves testing strategy, when
the user explicitly names `forge-testing`, or when discovery proves an applicable boundary.

- Executable software
- Release readiness

## When not to activate

- Non-executable documentation-only packages

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- test manifests and commands
- coverage configuration
- critical workflow inventory

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

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

Manual inspection requirements:

- Review omitted high-impact scenarios and test maintainability
- Inspect CI artifacts and quarantine policy

Stack-specific guidance:

- Use native test isolation and real boundary substitutes such as ephemeral databases where practical

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

- NIST SSDF
- testing-pyramid and contract-testing concepts

## Common production failures

- Map critical risks to unit, integration, contract, end-to-end, migration, security, and accessibility tests
- Inspect determinism, isolation, data factories, assertions, cleanup, time control, concurrency, and flaky retries
- Verify tests can fail for the defect they claim to detect and do not overmock the boundary under test

## Missing-control checks

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

## Commands and tools

- Run `forge testing audit --json` or `fullstack-forge testing audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add missing assertions and deterministic setup
- Remove an unnecessary retry only after proving the test is stable

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Deleting coverage, weakening assertions, or changing product behavior to satisfy tests

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run targeted tests before and after inducing a representative failure
- Run the relevant full suite after final edits

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

- Coverage percentage alone does not establish behavior coverage

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
