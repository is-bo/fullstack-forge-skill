---
name: forge-realtime
description: Inspect WebSocket, SSE, subscription, and presence flows for authorization, lifecycle, ordering, abuse, and recovery. Activate automatically for websockets, sse, subscriptions, live presence, or collaborative state when that concern is relevant to a software-engineering request.
---

# forge-realtime: Realtime communication

Engine: Hybrid — Forge + Supabase, Cloudflare, Sentry

## Purpose

Inspect WebSocket, SSE, subscription, and presence flows for authorization, lifecycle, ordering, abuse, and recovery.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

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

Deterministic support, bounded evidence only:

- `inspect-routes`
- `inspect-authorization`

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

Standards used as criteria:

- RFC 6455
- OWASP WebSocket Security Cheat Sheet

## Common production failures

- Authenticate handshakes and authorize every subscribe, publish, and resource action
- Inspect token expiry, revocation, origin, message schema and size, rate limits, backpressure, heartbeats, cleanup, and connection caps
- Check ordering, deduplication, cursor/resume, reconnect storms, stale presence, tenant namespaces, and sensitive errors

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add message bounds, schema validation, and cleanup
- Namespace channels and add bounded reconnect jitter

## Approval-required changes

- Changing delivery guarantees, channel authorization, or gateway topology

## Verification

- Test expired, revoked, unauthorized, duplicate, out-of-order, and oversized messages
- Disconnect abruptly and confirm cleanup and resume semantics

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Gateway and network behavior require runtime load evidence
