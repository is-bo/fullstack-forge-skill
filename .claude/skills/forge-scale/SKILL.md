---
name: forge-scale
description: Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios. Use for expected growth, load concentration, or capacity incidents.
---

# forge-scale: Scalability

## Purpose

Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-scale`, asks about scalability, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Expected growth, load concentration, or capacity incidents

## When it does not apply

- No scale requirement beyond measured current capacity

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- architecture and performance evidence
- capacity targets
- provider quotas

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. State the demand scenario first: expected users, concurrency, and data growth; without one, record the assumptions explicitly.
3. Find the first bottleneck: connection limits, stateful servers, shared filesystems, hot rows or hot tenants, and single-writer constraints.
4. Verify horizontal-scaling readiness: session placement, sticky state, file locality, and job distribution.
5. Check backpressure and load shedding: determine what happens at the queue, pool, and API layer when demand exceeds capacity.
6. Project storage, log, and cost growth against the scenario, and reject infrastructure additions (microservices, Kubernetes, Redis, queues) not justified by this evidence.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

- Model request, data, tenant, connection, queue, storage, and third-party growth
- Find serial bottlenecks, hot keys, fan-out, unbounded work, connection exhaustion, and noisy neighbors
- Inspect horizontal state, partition keys, rate shaping, load shedding, autoscaling signals, and graceful degradation

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Expected users
- Request concurrency
- Database connection limits
- Horizontal scaling
- Stateful application servers
- Session storage
- Shared file systems
- Queue throughput
- Rate limits
- Hot rows
- Hot tenants
- Large-customer behavior
- Bulk operations
- Backpressure
- Capacity assumptions
- Storage growth
- Log growth
- Cost at scale
- No microservices, Kubernetes, queues, or Redis without evidence

## Safe executable checks

- Run `forge scale audit --json` or `fullstack-forge scale audit --json` when
  the CLI is installed.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Validate growth and burst assumptions with operators and product owners
- Review regional and provider quota constraints

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-SCAL-001`, `FF-SCAL-002`, and so on. Preserve an ID across
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

- Add explicit bounds, batching, backpressure, and capacity telemetry
- Document measured limits

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Introducing services, sharding, queues, caches, or multi-region topology

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run staged load tests through saturation and recovery
- Confirm correctness and tenant fairness under contention

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- Google SRE capacity-planning concepts
- OpenTelemetry

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Account for framework connection pools, runtime concurrency, and managed-service quotas

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Capacity projections are only as credible as workload evidence

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
