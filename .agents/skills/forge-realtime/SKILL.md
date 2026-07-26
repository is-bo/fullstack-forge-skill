---
name: forge-realtime
description: Inspect WebSocket, SSE, subscription, and presence flows for authorization, lifecycle, ordering, abuse, and recovery. Activate automatically for websockets, sse, subscriptions, live presence, or collaborative state when that concern is relevant to a software-engineering request.
---

# forge-realtime: Realtime communication

## Purpose

Inspect WebSocket, SSE, subscription, and presence flows for authorization, lifecycle, ordering, abuse, and recovery.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves realtime communication, when
the user explicitly names `forge-realtime`, or when discovery proves an applicable boundary.

- WebSockets, SSE, subscriptions, live presence, or collaborative state

## When not to activate

- Request-response applications with no persistent or pushed channel

## Automated support

Relevant discovery inputs are:

- connection handlers
- channel and subscription policies
- client reconnection code

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Inventory WebSocket and SSE endpoints and subscriptions; verify authentication at connect and authorization per channel or topic.
2. Trace tenant and user separation of channels, presence, and broadcast fan-out.
3. Exercise reconnection: missed-message recovery, ordering, duplicates, and state resynchronization after a gap.
4. Check backpressure and slow-consumer handling, message-size limits, and rate limits per connection.
5. Verify authentication refresh on long-lived connections, and cleanup of subscriptions, timers, and server resources on disconnect.

Manual inspection requirements:

- Observe network interruption and multi-device behavior
- Review gateway limits and load-balancer timeouts

Stack-specific guidance:

- Enforce authorization server-side for each resource, not just at connection time

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add message bounds, schema validation, and cleanup
- Namespace channels and add bounded reconnect jitter

## Approval-required changes

- Changing delivery guarantees, channel authorization, or gateway topology

## Verification

- Test expired, revoked, unauthorized, duplicate, out-of-order, and oversized messages
- Disconnect abruptly and confirm cleanup and resume semantics

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Gateway and network behavior require runtime load evidence
