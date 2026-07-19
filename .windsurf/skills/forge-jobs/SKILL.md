---
name: forge-jobs
description: Inspect queued and scheduled work for durability, idempotency, retries, poison messages, and operability. Use for queues, workers, cron, scheduled functions, and outbox consumers.
---

# forge-jobs: Background jobs

## Purpose

Inspect queued and scheduled work for durability, idempotency, retries, poison messages, and operability.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-jobs`, asks about background jobs, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Queues, workers, cron, scheduled functions, and outbox consumers

## When it does not apply

- Applications with no asynchronous or scheduled execution

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- queue and scheduler configuration
- producers and consumers
- job tests

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory queues, workers, and scheduled jobs with their triggers, and trace one job from enqueue to completion including the failure path.
3. Verify idempotency: determine what happens when the same job runs twice, concurrently, or after a partial failure.
4. Inspect retry policy, backoff, limits, and the destination of permanently failing jobs (dead-letter or silent loss).
5. Check transaction boundaries: whether enqueue happens atomically with the state change that requires it (outbox or equivalent).
6. Verify observability: how an operator would find a stuck queue, a poison message, or a job that never ran, and how deploys interact with in-flight jobs.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

- Trace enqueue-to-effect flow and delivery guarantees
- Inspect idempotency keys, leases, timeouts, retries, jitter, dead-letter handling, ordering, concurrency, and payload versioning
- Verify transaction boundaries, outbox/inbox behavior, observability, replay, and shutdown

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Job idempotency
- Duplicate execution
- Retry limits
- Exponential backoff
- Dead-letter handling
- Timeouts
- Scheduling
- Concurrency
- Ordering
- Partial failures
- Transaction boundaries
- Poison messages
- Cancellation
- Progress reporting
- Safe deployment while jobs run
- Job observability
- Queue saturation
- Backpressure
- Email, invoice, image, reconciliation, report, notification, and import jobs

## Safe executable checks

- Run `forge jobs audit --json` or `fullstack-forge jobs audit --json` when
  the CLI is installed.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review operational replay and poison-message runbooks
- Confirm provider retention and retry settings outside the repository

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-JOBS-001`, `FF-JOBS-002`, and so on. Preserve an ID across
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

- Add bounded retry metadata, structured job logging, and payload validation
- Add tests for duplicate delivery

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Introducing a queue or changing delivery and ordering semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Deliver the same job twice and observe one durable outcome
- Force failure through retry and dead-letter paths

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- CloudEvents concepts
- NIST SSDF

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use provider-native acknowledgement and visibility-timeout semantics

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Managed queue policy is NOT_VERIFIED without configuration output

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
