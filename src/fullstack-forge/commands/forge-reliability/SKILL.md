---
name: forge-reliability
description: Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives. Use for services and critical workflows with availability or durability expectations.
---

# forge-reliability: Reliability

## Purpose

Audit timeouts, retries, overload, dependencies, degradation, consistency, and operational objectives.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-reliability`, asks about reliability, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Services and critical workflows with availability or durability expectations

## When it does not apply

- Disposable local-only utilities with no reliability objective

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- dependency graph
- SLOs
- failure handling and incident history

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

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

### Concrete checks

- Define user-visible service indicators and error-budget expectations
- Inspect timeout budgets, bounded retries, jitter, circuit behavior, health checks, overload, bulkheads, and dependency fallbacks
- Check graceful shutdown, deploy overlap, consistency, partial failure, idempotency, and clock assumptions

## Required inspection criteria

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

## Safe executable checks

- Run `forge reliability audit --json` or `fullstack-forge reliability audit --json` when
  the CLI is installed.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review known failure modes and incident learnings
- Confirm provider SLAs and operator escalation paths

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-RELI-001`, `FF-RELI-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- Add bounded timeouts, retry classification, and graceful shutdown
- Add health checks that reflect readiness without exposing internals

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing consistency, fail-open behavior, provider topology, or availability targets

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Inject dependency, timeout, overload, and shutdown failures
- Confirm recovery without duplicate durable effects

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- Google SRE principles
- RFC 9110

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Align platform health and termination semantics with application lifecycle

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Availability claims require measured production evidence

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
