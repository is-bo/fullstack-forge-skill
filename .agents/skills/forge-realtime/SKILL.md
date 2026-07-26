---
name: forge-realtime
description: Inspect WebSocket, SSE, subscription, and presence flows for authorization, lifecycle, ordering, abuse, and recovery. Activate automatically for websockets, sse, subscriptions, live presence, or collaborative state when that concern is relevant to a software-engineering request.
---

# forge-realtime: Realtime communication

## Purpose

Inspect WebSocket, SSE, subscription, and presence flows for authorization, lifecycle, ordering, abuse, and recovery.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves realtime communication, when
the user explicitly names `forge-realtime`, or when discovery proves an applicable boundary.

- WebSockets, SSE, subscriptions, live presence, or collaborative state

## When not to activate

- Request-response applications with no persistent or pushed channel

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- connection handlers
- channel and subscription policies
- client reconnection code

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory WebSocket and SSE endpoints and subscriptions; verify authentication at connect and authorization per channel or topic.
3. Trace tenant and user separation of channels, presence, and broadcast fan-out.
4. Exercise reconnection: missed-message recovery, ordering, duplicates, and state resynchronization after a gap.
5. Check backpressure and slow-consumer handling, message-size limits, and rate limits per connection.
6. Verify authentication refresh on long-lived connections, and cleanup of subscriptions, timers, and server resources on disconnect.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Observe network interruption and multi-device behavior
- Review gateway limits and load-balancer timeouts

Stack-specific guidance:

- Enforce authorization server-side for each resource, not just at connection time

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

- RFC 6455
- OWASP WebSocket Security Cheat Sheet

## Common production failures

- Authenticate handshakes and authorize every subscribe, publish, and resource action
- Inspect token expiry, revocation, origin, message schema and size, rate limits, backpressure, heartbeats, cleanup, and connection caps
- Check ordering, deduplication, cursor/resume, reconnect storms, stale presence, tenant namespaces, and sensitive errors

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- WebSocket authorization
- SSE authorization
- Reconnection
- Ordering
- Duplicate messages
- Presence
- Backpressure
- Resource cleanup
- Tenant-separated channels
- Rate limits
- Offline recovery
- Authentication refresh
- Subscription cleanup
- Fan-out
- Message size

## Commands and tools

- Run `forge realtime audit --json` or `fullstack-forge realtime audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add message bounds, schema validation, and cleanup
- Namespace channels and add bounded reconnect jitter

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing delivery guarantees, channel authorization, or gateway topology

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Test expired, revoked, unauthorized, duplicate, out-of-order, and oversized messages
- Disconnect abruptly and confirm cleanup and resume semantics

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

- Gateway and network behavior require runtime load evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
