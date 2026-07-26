---
name: forge-reliability
description: Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives. Activate automatically for services and critical workflows with availability or durability expectations when that concern is relevant to a software-engineering request.
---

# forge-reliability: Reliability

## Purpose

Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves reliability, when
the user explicitly names `forge-reliability`, or when discovery proves an applicable boundary.

- Services and critical workflows with availability or durability expectations

## When not to activate

- Disposable local-only utilities with no reliability objective

## Automated support

Relevant discovery inputs are:

- dependency graph
- SLOs
- failure handling and incident history

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Enumerate external dependencies and verify every remote call has a timeout, a bounded retry with idempotency, and a defined failure behavior.
2. Trace one dependency outage end to end: what the user sees, what degrades, and what data risks inconsistency.
3. Inspect health and readiness checks for truthfulness (they verify real dependencies) and safe shutdown for in-flight work.
4. Check retry-storm and thundering-herd protections at every retry site, and circuit breaking where cascades are possible.
5. Verify stated SLOs, recovery procedures, and consistency guarantees against implementation evidence, not documentation.

Manual inspection requirements:

- Review known failure modes and incident learnings
- Confirm provider SLAs and operator escalation paths

Stack-specific guidance:

- Align platform health and termination semantics with application lifecycle

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- Google SRE principles
- RFC 9110

## Common production failures

- Define user-visible service indicators and error-budget expectations
- Inspect timeout budgets, bounded retries, jitter, circuit behavior, health checks, overload, bulkheads, and dependency fallbacks
- Check graceful shutdown, deploy overlap, consistency, partial failure, idempotency, and clock assumptions

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Timeouts
- Retries
- Retry storms
- Circuit breaking
- Graceful degradation
- Health checks
- Readiness checks
- Dependency failures
- Partial outages
- Failover
- Idempotency
- Load shedding
- Safe shutdown
- Data consistency
- SLOs
- Recovery procedures
- Regional failures
- Feature degradation
- User-visible failure behavior

## Commands and tools

- Run `forge reliability audit --json` or `fullstack-forge reliability audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add bounded timeouts, retry classification, and graceful shutdown
- Add health checks that reflect readiness without exposing internals

## Approval-required changes

- Changing consistency, fail-open behavior, provider topology, or availability targets

## Verification

- Inject dependency, timeout, overload, and shutdown failures
- Confirm recovery without duplicate durable effects

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Availability claims require measured production evidence
