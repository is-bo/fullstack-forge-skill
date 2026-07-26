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

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing delivery guarantees, channel authorization, or gateway topology

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Test expired, revoked, unauthorized, duplicate, out-of-order, and oversized messages
- Disconnect abruptly and confirm cleanup and resume semantics

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Gateway and network behavior require runtime load evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
