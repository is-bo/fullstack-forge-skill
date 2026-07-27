---
name: forge-testing
description: Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes. Activate automatically for executable software when that concern is relevant to a software-engineering request.
---

# forge-testing: Testing strategy

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Evaluate whether tests provide reliable risk-based evidence across units, boundaries, workflows, and failure modes.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

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

Deterministic support, bounded evidence only:

- `detect-project-commands`
- `run-project-command`

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

Standards used as criteria:

- NIST SSDF
- testing-pyramid and contract-testing concepts

## Common production failures

- Map critical risks to unit, integration, contract, end-to-end, migration, security, and accessibility tests
- Inspect determinism, isolation, data factories, assertions, cleanup, time control, concurrency, and flaky retries
- Verify tests can fail for the defect they claim to detect and do not overmock the boundary under test

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add missing assertions and deterministic setup
- Remove an unnecessary retry only after proving the test is stable

## Approval-required changes

- Deleting coverage, weakening assertions, or changing product behavior to satisfy tests

## Verification

- Run targeted tests before and after inducing a representative failure
- Run the relevant full suite after final edits

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Coverage percentage alone does not establish behavior coverage
