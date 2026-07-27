---
name: forge-code
description: Find correctness, maintainability, type-safety, error-handling, and dead-code risks in changed and critical paths. Activate automatically for source changes when that concern is relevant to a software-engineering request.
---

# forge-code: Code quality

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Find correctness, maintainability, type-safety, error-handling, and dead-code risks in changed and critical paths.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves code quality, when
the user explicitly names `forge-code`, or when discovery proves an applicable boundary.

- Source changes
- Release readiness
- Refactoring

## When not to activate

- Repositories containing only non-executable documentation

## Automated support

Relevant discovery inputs are:

- project profile
- changed-file set
- formatter, linter, and typecheck commands

Deterministic support, bounded evidence only:

- `detect-project-commands`
- `run-project-command`

## Agent inspection procedure

1. Run the project's own formatter, linter, and type checker in check mode and record their exact exit codes and counts.
2. Sample the highest-churn and highest-complexity files and inspect error handling, unsafe casts, and unhandled promise paths.
3. Search for dead exports, duplicated logic, and TODO/FIXME markers, verifying each candidate is genuinely unreferenced before reporting it.
4. Trace resource lifecycles: opened handles, listeners, timers, and subscriptions, and verify each has a close or cleanup path.
5. Check the test surface of changed code paths and record which risky functions have no direct test.

Manual inspection requirements:

- Review complex control flow and public API clarity
- Inspect generated or excluded paths not covered by tools

Stack-specific guidance:

- Use the repository's pinned toolchain and scripts

## Evidence to collect

Standards used as criteria:

- NIST SSDF
- language-specific style guidance

## Common production failures

- Run available format, lint, type, unit, and build checks without hiding failures
- Inspect boundary validation, error propagation, resource cleanup, concurrency, and unsafe casts
- Compare changes with the newest established local precedent and remove only proven dead code

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Apply deterministic formatting
- Correct proven lint, typing, cleanup, and assertion defects

## Approval-required changes

- Changing a public contract or broad behavior during cleanup

## Verification

- Run gates after the final edit
- Exercise the affected behavior rather than relying only on compilation

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Static analysis cannot prove runtime behavior or requirement intent
