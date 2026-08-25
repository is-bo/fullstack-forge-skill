---
name: forge-reliability
description: "Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives."
---

# forge-reliability: Reliability

Engine: Hybrid — Forge + Google, Addy Osmani Agent Skills, Sentry, Cloudflare

## Purpose

Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" reliability compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

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
