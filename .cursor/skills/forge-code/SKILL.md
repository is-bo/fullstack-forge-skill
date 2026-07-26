---
name: forge-code
description: Find correctness, maintainability, type-safety, error-handling, and dead-code risks in changed and critical paths. Activate automatically for source changes when that concern is relevant to a software-engineering request.
---

# forge-code: Code quality

## Purpose

Find correctness, maintainability, type-safety, error-handling, and dead-code risks in changed and critical paths.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves code quality, when
the user explicitly names `forge-code`, or when discovery proves an applicable boundary.

- Source changes
- Release readiness
- Refactoring

## When not to activate

- Repositories containing only non-executable documentation

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- project profile
- changed-file set
- formatter, linter, and typecheck commands

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Run the project's own formatter, linter, and type checker in check mode and record their exact exit codes and counts.
3. Sample the highest-churn and highest-complexity files and inspect error handling, unsafe casts, and unhandled promise paths.
4. Search for dead exports, duplicated logic, and TODO/FIXME markers, verifying each candidate is genuinely unreferenced before reporting it.
5. Trace resource lifecycles: opened handles, listeners, timers, and subscriptions, and verify each has a close or cleanup path.
6. Check the test surface of changed code paths and record which risky functions have no direct test.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review complex control flow and public API clarity
- Inspect generated or excluded paths not covered by tools

Stack-specific guidance:

- Use the repository's pinned toolchain and scripts

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
- language-specific style guidance

## Common production failures

- Run available format, lint, type, unit, and build checks without hiding failures
- Inspect boundary validation, error propagation, resource cleanup, concurrency, and unsafe casts
- Compare changes with the newest established local precedent and remove only proven dead code

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Type safety
- Linting
- Formatting
- Dead code
- Duplicate code
- Excessive complexity
- Unsafe casts
- Unhandled promises
- Resource leaks
- Event-listener leaks
- Deprecated APIs
- Error handling
- Hidden side effects
- Unsafe global state
- Testability
- Naming
- Comments
- TODO and FIXME items
- Generated-code boundaries
- Dependency direction
- Maintainability
- Existing formatter, linter, type checker, and static-analysis commands

## Commands and tools

- Run `forge code audit --json` or `fullstack-forge code audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Apply deterministic formatting
- Correct proven lint, typing, cleanup, and assertion defects

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing a public contract or broad behavior during cleanup

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run gates after the final edit
- Exercise the affected behavior rather than relying only on compilation

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

- Static analysis cannot prove runtime behavior or requirement intent

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
