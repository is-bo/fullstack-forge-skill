---
name: forge-offline
description: Audit local persistence, queued actions, synchronization, conflicts, revocation, privacy, and recovery under intermittent connectivity. Activate automatically for offline-capable web, mobile, or desktop applications when that concern is relevant to a software-engineering request.
---

# forge-offline: Offline behavior

## Purpose

Audit local persistence, queued actions, synchronization, conflicts, revocation, privacy, and recovery under intermittent connectivity.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

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

Available deterministic support, where present:

- Use `detect-stack` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

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

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- Service Workers specification
- OWASP Mobile Application Security concepts

## Common production failures

- Inventory locally stored data, cached responses, queued actions, versioning, encryption, and eviction
- Inspect duplicate delivery, ordering, conflict detection/resolution, tombstones, schema migration, partial sync, clock skew, and retry bounds
- Verify logout, revocation, role/tenant changes, device loss, shared-device privacy, stale authorization, and cache invalidation

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add queue idempotency keys, version markers, and explicit offline states
- Clear scoped private caches on verified logout

## Approval-required changes

- Changing conflict policy, offline authorization, retention, or destructive synchronization

## Verification

- Run online-offline-reconnect flows with duplicate and conflicting actions
- Confirm revoked access does not remain usable offline beyond stated policy

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Platform background-execution and storage eviction vary by device
