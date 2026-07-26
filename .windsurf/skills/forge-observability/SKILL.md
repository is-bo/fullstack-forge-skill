---
name: forge-observability
description: Verify that logs, metrics, traces, events, alerts, and dashboards answer concrete operational questions safely. Activate automatically for long-running or production services when that concern is relevant to a software-engineering request.
---

# forge-observability: Observability

## Purpose

Verify that logs, metrics, traces, events, alerts, and dashboards answer concrete operational questions safely.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves observability, when
the user explicitly names `forge-observability`, or when discovery proves an applicable boundary.

- Long-running or production services
- Critical client workflows

## When not to activate

- Pure build-time artifacts with no runtime behavior

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- telemetry instrumentation
- dashboards and alerts as code
- incident runbooks

Available deterministic support, where present:

- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Pick three real operational questions (why is this request slow, what failed for this user, is this job stuck) and verify the current telemetry can answer each.
3. Inspect log structure, levels, correlation and request identifiers, and propagation across services and jobs.
4. Verify metrics and traces exist for the critical paths, with OpenTelemetry-compatible semantics where practical.
5. Check alerting: which failures page someone, which dashboards exist, and whether silent failure modes (dead queues, cron no-runs) are detected.
6. Inspect telemetry for sensitive-data leakage and verify retention and sampling policies.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Use telemetry to answer latency, error, saturation, and affected-user questions
- Review deployed dashboards and paging routes

Stack-specific guidance:

- Instrument framework and provider boundaries without double-counting spans

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

- OpenTelemetry Specification 1.59
- OWASP Logging Cheat Sheet

## Common production failures

- Trace a request across service, job, database, and integration boundaries with stable correlation
- Inspect structured event names, metric units, cardinality, sampling, error status, service metadata, and deployment version
- Check alert symptom quality, ownership, runbook links, SLO coverage, redaction, access, and retention

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Structured logs
- Log levels
- Correlation IDs
- Request IDs
- Metrics
- Traces
- Error monitoring
- Business events
- Sensitive-data redaction
- Dashboards
- Alerts
- Job monitoring
- Database monitoring
- External-integration monitoring
- Audit logs
- Retention
- Sampling
- OpenTelemetry-compatible concepts where practical

## Commands and tools

- Run `forge observability audit --json` or `fullstack-forge observability audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add bounded context and correlation identifiers
- Redact secrets and high-cardinality or personal fields

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing telemetry vendors, retention, sampling, or personal-data collection

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Generate a known success and failure and locate both in telemetry
- Validate alerts with a controlled signal where safe

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

- Instrumentation code does not prove deployed ingestion or alert delivery

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
