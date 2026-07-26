---
name: forge-jobs
description: Inspect queued and scheduled work for durability, idempotency, retries, poison messages, and operability. Activate automatically for queues, workers, cron, scheduled functions, and outbox consumers when that concern is relevant to a software-engineering request.
---

# forge-jobs: Background jobs

## Purpose

Inspect queued and scheduled work for durability, idempotency, retries, poison messages, and operability.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves background jobs, when
the user explicitly names `forge-jobs`, or when discovery proves an applicable boundary.

- Queues, workers, cron, scheduled functions, and outbox consumers

## When not to activate

- Applications with no asynchronous or scheduled execution

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- queue and scheduler configuration
- producers and consumers
- job tests

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

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

Manual inspection requirements:

- Review operational replay and poison-message runbooks
- Confirm provider retention and retry settings outside the repository

Stack-specific guidance:

- Use provider-native acknowledgement and visibility-timeout semantics

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

- CloudEvents concepts
- NIST SSDF

## Common production failures

- Trace enqueue-to-effect flow and delivery guarantees
- Inspect idempotency keys, leases, timeouts, retries, jitter, dead-letter handling, ordering, concurrency, and payload versioning
- Verify transaction boundaries, outbox/inbox behavior, observability, replay, and shutdown

## Missing-control checks

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

## Commands and tools

- Run `forge jobs audit --json` or `fullstack-forge jobs audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add bounded retry metadata, structured job logging, and payload validation
- Add tests for duplicate delivery

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Introducing a queue or changing delivery and ordering semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Deliver the same job twice and observe one durable outcome
- Force failure through retry and dead-letter paths

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

- Managed queue policy is NOT_VERIFIED without configuration output

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
