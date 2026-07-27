---
name: forge-requirements
description: Trace business rules and acceptance criteria to executable behavior, including adverse and recovery paths. Activate automatically for feature work when that concern is relevant to a software-engineering request.
---

# forge-requirements: Requirements and domain logic

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Trace business rules and acceptance criteria to executable behavior, including adverse and recovery paths.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves requirements and domain logic, when
the user explicitly names `forge-requirements`, or when discovery proves an applicable boundary.

- Feature work
- Domain-rule changes
- Release readiness

## When not to activate

- Pure formatting changes with no behavior impact

## Automated support

Relevant discovery inputs are:

- project profile
- product documentation
- tests and route handlers

Deterministic support, bounded evidence only:

- `detect-project-commands`
- `run-project-command`

## Agent inspection procedure

1. Collect the requirement sources that exist: issues, specifications, READMEs, acceptance tests, and inline business rules, and record where each behavior is defined.
2. Trace each stated business rule to the code path and test that enforces it, recording rules that exist only in prose.
3. Enumerate state machines and lifecycle transitions (orders, subscriptions, approvals) and check that every declared state has entry, exit, and failure handling.
4. Inspect financial calculations for currency units, rounding mode, and precision, and compare them against the documented business rule.
5. Probe undefined behavior: ownership after deletion, permission defaults, concurrent edits, and time-zone-dependent rules, and record contradictions between sources.

Manual inspection requirements:

- Confirm ambiguous business policy with an accountable owner
- Review financial, entitlement, and lifecycle rules with representative examples

Stack-specific guidance:

- Locate validation in the actual domain boundary rather than only the UI

## Evidence to collect

Standards used as criteria:

- ISO/IEC/IEEE 29148 concepts
- RFC 2119 requirement language

## Common production failures

- Trace stated outcomes, invariants, duplicate-operation behavior, recovery, ownership, and offline assumptions to code and tests
- Identify contradictory rules and hidden defaults at trust boundaries
- Exercise success, empty, error, retry, cancellation, and partial-failure paths

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add missing assertions for an already-established rule
- Document an observed invariant and its evidence

## Approval-required changes

- Changing business policy, ownership, pricing, or entitlement semantics

## Verification

- Run targeted acceptance tests
- Map every claimed requirement to code, test, or NOT_VERIFIED evidence

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Unwritten policy cannot be inferred as verified intent
