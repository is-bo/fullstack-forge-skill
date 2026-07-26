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

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing business policy, ownership, pricing, or entitlement semantics

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run targeted acceptance tests
- Map every claimed requirement to code, test, or NOT_VERIFIED evidence

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Unwritten policy cannot be inferred as verified intent

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
