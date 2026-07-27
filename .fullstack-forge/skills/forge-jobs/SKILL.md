---
name: forge-jobs
description: Inspect queued and scheduled work for durability, idempotency, retries, poison messages, and operability. Activate automatically for queues, workers, cron, scheduled functions, and outbox consumers when that concern is relevant to a software-engineering request.
---

# forge-jobs: Background jobs

## Purpose

Inspect queued and scheduled work for durability, idempotency, retries, poison messages, and operability.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves background jobs, when
the user explicitly names `forge-jobs`, or when discovery proves an applicable boundary.

- Queues, workers, cron, scheduled functions, and outbox consumers

## When not to activate

- Applications with no asynchronous or scheduled execution

## Automated support

Relevant discovery inputs are:

- queue and scheduler configuration
- producers and consumers
- job tests

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Inventory queues, workers, and scheduled jobs with their triggers, and trace one job from enqueue to completion including the failure path.
2. Verify idempotency: determine what happens when the same job runs twice, concurrently, or after a partial failure.
3. Inspect retry policy, backoff, limits, and the destination of permanently failing jobs (dead-letter or silent loss).
4. Check transaction boundaries: whether enqueue happens atomically with the state change that requires it (outbox or equivalent).
5. Verify observability: how an operator would find a stuck queue, a poison message, or a job that never ran, and how deploys interact with in-flight jobs.

Manual inspection requirements:

- Review operational replay and poison-message runbooks
- Confirm provider retention and retry settings outside the repository

Stack-specific guidance:

- Use provider-native acknowledgement and visibility-timeout semantics

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add bounded retry metadata, structured job logging, and payload validation
- Add tests for duplicate delivery

## Approval-required changes

- Introducing a queue or changing delivery and ordering semantics

## Verification

- Deliver the same job twice and observe one durable outcome
- Force failure through retry and dead-letter paths

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Managed queue policy is NOT_VERIFIED without configuration output
