---
name: forge-observability
description: Verify that logs, metrics, traces, events, alerts, and dashboards answer concrete operational questions safely. Activate automatically for long-running or production services when that concern is relevant to a software-engineering request.
---

# forge-observability: Observability

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Sentry, Google

## Purpose

Verify that logs, metrics, traces, events, alerts, and dashboards answer concrete operational questions safely.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves observability, when
the user explicitly names `forge-observability`, or when discovery proves an applicable boundary.

- Long-running or production services
- Critical client workflows

## When not to activate

- Pure build-time artifacts with no runtime behavior

## Automated support

Relevant discovery inputs are:

- telemetry instrumentation
- dashboards and alerts as code
- incident runbooks

Deterministic support, bounded evidence only:

- `inspect-deployment-config`

## Agent inspection procedure

1. Pick three real operational questions (why is this request slow, what failed for this user, is this job stuck) and verify the current telemetry can answer each.
2. Inspect log structure, levels, correlation and request identifiers, and propagation across services and jobs.
3. Verify metrics and traces exist for the critical paths, with OpenTelemetry-compatible semantics where practical.
4. Check alerting: which failures page someone, which dashboards exist, and whether silent failure modes (dead queues, cron no-runs) are detected.
5. Inspect telemetry for sensitive-data leakage and verify retention and sampling policies.

Manual inspection requirements:

- Use telemetry to answer latency, error, saturation, and affected-user questions
- Review deployed dashboards and paging routes

Stack-specific guidance:

- Instrument framework and provider boundaries without double-counting spans

## Evidence to collect

Standards used as criteria:

- OpenTelemetry Specification 1.59
- OWASP Logging Cheat Sheet

## Common production failures

- Trace a request across service, job, database, and integration boundaries with stable correlation
- Inspect structured event names, metric units, cardinality, sampling, error status, service metadata, and deployment version
- Check alert symptom quality, ownership, runbook links, SLO coverage, redaction, access, and retention

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add bounded context and correlation identifiers
- Redact secrets and high-cardinality or personal fields

## Approval-required changes

- Changing telemetry vendors, retention, sampling, or personal-data collection

## Verification

- Generate a known success and failure and locate both in telemetry
- Validate alerts with a controlled signal where safe

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Instrumentation code does not prove deployed ingestion or alert delivery
