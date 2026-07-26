---
name: forge-offline
description: Audit local persistence, queued actions, synchronization, conflicts, revocation, privacy, and recovery under intermittent connectivity. Activate automatically for offline-capable web, mobile, or desktop applications when that concern is relevant to a software-engineering request.
---

# forge-offline: Offline behavior

## Purpose

Audit local persistence, queued actions, synchronization, conflicts, revocation, privacy, and recovery under intermittent connectivity.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves offline behavior, when
the user explicitly names `forge-offline`, or when discovery proves an applicable boundary.

- Offline-capable web, mobile, or desktop applications
- Clients that queue writes or cache private state

## When not to activate

- Online-only clients that store no durable application data locally

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- service workers and local stores
- sync protocol
- authorization and conflict rules

Available deterministic support, where present:

- Use `detect-stack` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Map what is persisted locally: service-worker caches, IndexedDB, local storage, and their versioning and migration strategy.
3. Trace an offline write to synchronization: queuing, retry, conflict detection, and resolution semantics.
4. Exercise partial-sync interruption and recovery, duplicate-operation defense, and stale-data presentation.
5. Verify security: local encryption where warranted, cleanup at logout, and offline authorization assumptions (entitlement and license behavior, clock manipulation).
6. Check cache-version rollover: old clients against new APIs, and cache invalidation on deploy.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Exercise long-offline, low-storage, clock-change, and multi-device edits
- Review user-visible conflict and data-loss recovery

Stack-specific guidance:

- Treat the local database and service-worker cache as separate security boundaries

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
- Use `detect-stack` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add queue idempotency keys, version markers, and explicit offline states
- Clear scoped private caches on verified logout

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing conflict policy, offline authorization, retention, or destructive synchronization

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run online-offline-reconnect flows with duplicate and conflicting actions
- Confirm revoked access does not remain usable offline beyond stated policy

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

- Platform background-execution and storage eviction vary by device

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
