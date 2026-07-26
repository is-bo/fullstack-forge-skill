---
name: forge-reliability
description: Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives. Activate automatically for services and critical workflows with availability or durability expectations when that concern is relevant to a software-engineering request.
---

# forge-reliability: Reliability

## Purpose

Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves reliability, when
the user explicitly names `forge-reliability`, or when discovery proves an applicable boundary.

- Services and critical workflows with availability or durability expectations

## When not to activate

- Disposable local-only utilities with no reliability objective

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- dependency graph
- SLOs
- failure handling and incident history

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Enumerate external dependencies and verify every remote call has a timeout, a bounded retry with idempotency, and a defined failure behavior.
3. Trace one dependency outage end to end: what the user sees, what degrades, and what data risks inconsistency.
4. Inspect health and readiness checks for truthfulness (they verify real dependencies) and safe shutdown for in-flight work.
5. Check retry-storm and thundering-herd protections at every retry site, and circuit breaking where cascades are possible.
6. Verify stated SLOs, recovery procedures, and consistency guarantees against implementation evidence, not documentation.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review known failure modes and incident learnings
- Confirm provider SLAs and operator escalation paths

Stack-specific guidance:

- Align platform health and termination semantics with application lifecycle

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
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add bounded timeouts, retry classification, and graceful shutdown
- Add health checks that reflect readiness without exposing internals

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing consistency, fail-open behavior, provider topology, or availability targets

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Inject dependency, timeout, overload, and shutdown failures
- Confirm recovery without duplicate durable effects

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

- Availability claims require measured production evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
