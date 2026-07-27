---
name: forge-reliability
description: Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives. Activate automatically for services and critical workflows with availability or durability expectations when that concern is relevant to a software-engineering request.
---

# forge-reliability: Reliability

Engine: Hybrid — Forge + Google, Addy Osmani Agent Skills, Sentry, Cloudflare

## Purpose

Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

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

Deterministic support, bounded evidence only:

- `detect-project-commands`
- `run-project-command`

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

Standards used as criteria:

- Google SRE principles
- RFC 9110

## Common production failures

- Define user-visible service indicators and error-budget expectations
- Inspect timeout budgets, bounded retries, jitter, circuit behavior, health checks, overload, bulkheads, and dependency fallbacks
- Check graceful shutdown, deploy overlap, consistency, partial failure, idempotency, and clock assumptions

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add bounded timeouts, retry classification, and graceful shutdown
- Add health checks that reflect readiness without exposing internals

## Approval-required changes

- Changing consistency, fail-open behavior, provider topology, or availability targets

## Verification

- Inject dependency, timeout, overload, and shutdown failures
- Confirm recovery without duplicate durable effects

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Availability claims require measured production evidence
