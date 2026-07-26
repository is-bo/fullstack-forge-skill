---
name: forge-integrations
description: Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety. Activate automatically for third-party apis, webhooks, sdks, and service-to-service calls when that concern is relevant to a software-engineering request.
---

# forge-integrations: External integrations

## Purpose

Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves external integrations, when
the user explicitly names `forge-integrations`, or when discovery proves an applicable boundary.

- Third-party APIs, webhooks, SDKs, and service-to-service calls

## When not to activate

- Self-contained applications with no external dependency

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- integration inventory
- SDK manifests
- webhook routes and secrets

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory outbound calls and inbound webhooks with their providers, credentials, and code locations.
3. For each outbound call verify timeout, retry policy with idempotency, rate-limit handling, and response validation before use.
4. For each inbound webhook trace signature verification over raw bytes before parsing, then duplicate and out-of-order delivery handling.
5. Check environment separation: sandbox versus production credentials, endpoints, and event routing.
6. Probe failure isolation: determine what user-visible behavior results when the provider is down, slow, or returns malformed data.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review provider dashboards, quotas, and deprecation notices
- Confirm contractual retention and incident obligations

Stack-specific guidance:

- Prefer official SDK verification primitives while validating their configured options

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

- OWASP API Security Top 10 2023
- RFC 9110

## Common production failures

- Inspect timeouts, bounded retries, jitter, circuit behavior, rate limits, and fallback
- Verify webhook signatures against raw bytes, freshness, replay defense, and event idempotency
- Check credential scope, version pinning, data minimization, sandbox separation, and error redaction

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add explicit timeouts, payload validation, and secret redaction
- Pin a compatible SDK version after tests

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing provider, credentials, contractual data flow, or failure policy

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Replay signed and tampered payloads
- Simulate timeout, rate limit, and provider error responses

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

- Provider-side state and contracts require external evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
