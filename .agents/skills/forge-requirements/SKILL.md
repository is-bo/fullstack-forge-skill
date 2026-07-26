---
name: forge-requirements
description: Trace business rules and acceptance criteria to executable behavior, including adverse and recovery paths. Activate automatically for feature work when that concern is relevant to a software-engineering request.
---

# forge-requirements: Requirements and domain logic

## Purpose

Trace business rules and acceptance criteria to executable behavior, including adverse and recovery paths.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves requirements and domain logic, when
the user explicitly names `forge-requirements`, or when discovery proves an applicable boundary.

- Feature work
- Domain-rule changes
- Release readiness

## When not to activate

- Pure formatting changes with no behavior impact

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- project profile
- product documentation
- tests and route handlers

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Collect the requirement sources that exist: issues, specifications, READMEs, acceptance tests, and inline business rules, and record where each behavior is defined.
3. Trace each stated business rule to the code path and test that enforces it, recording rules that exist only in prose.
4. Enumerate state machines and lifecycle transitions (orders, subscriptions, approvals) and check that every declared state has entry, exit, and failure handling.
5. Inspect financial calculations for currency units, rounding mode, and precision, and compare them against the documented business rule.
6. Probe undefined behavior: ownership after deletion, permission defaults, concurrent edits, and time-zone-dependent rules, and record contradictions between sources.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Confirm ambiguous business policy with an accountable owner
- Review financial, entitlement, and lifecycle rules with representative examples

Stack-specific guidance:

- Locate validation in the actual domain boundary rather than only the UI

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

- ISO/IEC/IEEE 29148 concepts
- RFC 2119 requirement language

## Common production failures

- Trace stated outcomes, invariants, duplicate-operation behavior, recovery, ownership, and offline assumptions to code and tests
- Identify contradictory rules and hidden defaults at trust boundaries
- Exercise success, empty, error, retry, cancellation, and partial-failure paths

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Missing requirements
- Contradictory requirements
- Acceptance criteria
- User roles
- Business rules
- State transitions
- Edge cases
- Financial calculations
- Currency handling and rounding
- Dates and time zones
- Failure recovery
- Destructive operations
- Audit requirements
- Legal or regulated workflows
- Requirement-to-test traceability
- Undefined ownership
- Undefined permission behavior
- Irreversible actions
- Correct business behavior rather than technical function alone

## Commands and tools

- Run `forge requirements audit --json` or `fullstack-forge requirements audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add missing assertions for an already-established rule
- Document an observed invariant and its evidence

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing business policy, ownership, pricing, or entitlement semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run targeted acceptance tests
- Map every claimed requirement to code, test, or NOT_VERIFIED evidence

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

- Unwritten policy cannot be inferred as verified intent

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
