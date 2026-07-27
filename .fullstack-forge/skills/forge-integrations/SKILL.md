---
name: forge-integrations
description: Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety. Activate automatically for third-party apis, webhooks, sdks, and service-to-service calls when that concern is relevant to a software-engineering request.
---

# forge-integrations: External integrations

Engine: Forge native

## Purpose

Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves external integrations, when
the user explicitly names `forge-integrations`, or when discovery proves an applicable boundary.

- Third-party APIs, webhooks, SDKs, and service-to-service calls

## When not to activate

- Self-contained applications with no external dependency

## Automated support

Relevant discovery inputs are:

- integration inventory
- SDK manifests
- webhook routes and secrets

Deterministic support, bounded evidence only:

- `inspect-routes`

## Agent inspection procedure

1. Inventory outbound calls and inbound webhooks with their providers, credentials, and code locations.
2. For each outbound call verify timeout, retry policy with idempotency, rate-limit handling, and response validation before use.
3. For each inbound webhook trace signature verification over raw bytes before parsing, then duplicate and out-of-order delivery handling.
4. Check environment separation: sandbox versus production credentials, endpoints, and event routing.
5. Probe failure isolation: determine what user-visible behavior results when the provider is down, slow, or returns malformed data.

Manual inspection requirements:

- Review provider dashboards, quotas, and deprecation notices
- Confirm contractual retention and incident obligations

Stack-specific guidance:

- Prefer official SDK verification primitives while validating their configured options

## Evidence to collect

Standards used as criteria:

- OWASP API Security Top 10 2023
- RFC 9110

## Common production failures

- Inspect timeouts, bounded retries, jitter, circuit behavior, rate limits, and fallback
- Verify webhook signatures against raw bytes, freshness, replay defense, and event idempotency
- Check credential scope, version pinning, data minimization, sandbox separation, and error redaction

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Timeouts
- Retry strategy
- Idempotency keys
- Signature verification
- Replay prevention
- Provider outages
- Rate-limit handling
- Request validation
- Response validation
- Secret rotation
- Sandbox versus production separation
- Duplicate events
- Out-of-order events
- API version changes
- Data mapping
- Logging
- Fallback behavior
- Circuit breaking
- Partial failures

## Commands and tools

- Run `forge integrations audit --json` or `fullstack-forge integrations audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Add explicit timeouts, payload validation, and secret redaction
- Pin a compatible SDK version after tests

## Approval-required changes

- Changing provider, credentials, contractual data flow, or failure policy

## Verification

- Replay signed and tampered payloads
- Simulate timeout, rate limit, and provider error responses

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Provider-side state and contracts require external evidence
