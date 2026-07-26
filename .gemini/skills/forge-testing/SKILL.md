---
name: forge-testing
description: Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes. Activate automatically for executable software when that concern is relevant to a software-engineering request.
---

# forge-testing: Testing strategy

## Purpose

Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves testing strategy, when
the user explicitly names `forge-testing`, or when discovery proves an applicable boundary.

- Executable software
- Release readiness

## When not to activate

- Non-executable documentation-only packages

## Automated support

Relevant discovery inputs are:

- test manifests and commands
- coverage configuration
- critical workflow inventory

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Map the test pyramid: what exists at unit, integration, API, end-to-end, and evaluation level, and what each layer actually asserts.
2. Trace the riskiest workflows from discovery to their covering tests; record critical paths with no failure-path or authorization test.
3. Inspect test quality: assertions that prove behavior versus existence, mock realism, isolation, and determinism (hunt flaky patterns).
4. Verify negative coverage: unauthorized access, invalid input, concurrency, retries, and idempotency for the paths that claim them.
5. Run the suite and record counts, duration, skips, and any tests that cannot fail.

Manual inspection requirements:

- Review omitted high-impact scenarios and test maintainability
- Inspect CI artifacts and quarantine policy

Stack-specific guidance:

- Use native test isolation and real boundary substitutes such as ephemeral databases where practical

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add missing assertions and deterministic setup
- Remove an unnecessary retry only after proving the test is stable

## Approval-required changes

- Deleting coverage, weakening assertions, or changing product behavior to satisfy tests

## Verification

- Run targeted tests before and after inducing a representative failure
- Run the relevant full suite after final edits

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Coverage percentage alone does not establish behavior coverage
