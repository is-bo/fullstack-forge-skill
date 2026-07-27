---
name: forge-offline
description: Audit local persistence, queued actions, synchronization, conflicts, revocation, privacy, and recovery under intermittent connectivity. Activate automatically for offline-capable web, mobile, or desktop applications when that concern is relevant to a software-engineering request.
---

# forge-offline: Offline behavior

## Purpose

Audit local persistence, queued actions, synchronization, conflicts, revocation, privacy, and recovery under intermittent connectivity.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves offline behavior, when
the user explicitly names `forge-offline`, or when discovery proves an applicable boundary.

- Offline-capable web, mobile, or desktop applications
- Clients that queue writes or cache private state

## When not to activate

- Online-only clients that store no durable application data locally

## Automated support

Relevant discovery inputs are:

- service workers and local stores
- sync protocol
- authorization and conflict rules

Deterministic support, bounded evidence only:

- `detect-stack`

## Agent inspection procedure

1. Map what is persisted locally: service-worker caches, IndexedDB, local storage, and their versioning and migration strategy.
2. Trace an offline write to synchronization: queuing, retry, conflict detection, and resolution semantics.
3. Exercise partial-sync interruption and recovery, duplicate-operation defense, and stale-data presentation.
4. Verify security: local encryption where warranted, cleanup at logout, and offline authorization assumptions (entitlement and license behavior, clock manipulation).
5. Check cache-version rollover: old clients against new APIs, and cache invalidation on deploy.

Manual inspection requirements:

- Exercise long-offline, low-storage, clock-change, and multi-device edits
- Review user-visible conflict and data-loss recovery

Stack-specific guidance:

- Treat the local database and service-worker cache as separate security boundaries

## Evidence to collect

Standards used as criteria:

- Service Workers specification
- OWASP Mobile Application Security concepts

## Common production failures

- Inventory locally stored data, cached responses, queued actions, versioning, encryption, and eviction
- Inspect duplicate delivery, ordering, conflict detection/resolution, tombstones, schema migration, partial sync, clock skew, and retry bounds
- Verify logout, revocation, role/tenant changes, device loss, shared-device privacy, stale authorization, and cache invalidation

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Service workers
- Cache versioning
- Offline writes
- Conflict resolution
- Synchronization
- Stale data
- IndexedDB
- Local databases
- Local storage
- Encryption
- Logout cleanup
- Subscription and license behavior
- Clock manipulation
- Partial synchronization
- Recovery
- Duplicate operations
- Data ownership
- Offline authorization assumptions

## Commands and tools

- Run `forge offline audit --json` or `fullstack-forge offline audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Add queue idempotency keys, version markers, and explicit offline states
- Clear scoped private caches on verified logout

## Approval-required changes

- Changing conflict policy, offline authorization, retention, or destructive synchronization

## Verification

- Run online-offline-reconnect flows with duplicate and conflicting actions
- Confirm revoked access does not remain usable offline beyond stated policy

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Platform background-execution and storage eviction vary by device
