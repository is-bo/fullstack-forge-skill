---
name: forge-integrations
description: "Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety."
---

# forge-integrations: External integrations

Engine: Forge native

## Purpose

Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" integrations compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

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
