---
name: forge-integrations
description: Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety. Use for third-party apis, webhooks, sdks, and service-to-service calls.
---

# forge-integrations: External integrations

## Purpose

Audit outbound and inbound integrations for authentication, validation, failure isolation, drift, and replay safety.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-integrations`, asks about external integrations, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Third-party APIs, webhooks, SDKs, and service-to-service calls

## When it does not apply

- Self-contained applications with no external dependency

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- integration inventory
- SDK manifests
- webhook routes and secrets

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

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

### Concrete checks

- Inspect timeouts, bounded retries, jitter, circuit behavior, rate limits, and fallback
- Verify webhook signatures against raw bytes, freshness, replay defense, and event idempotency
- Check credential scope, version pinning, data minimization, sandbox separation, and error redaction

## Required inspection criteria

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

## Safe executable checks

- Run `forge integrations audit --json` or `fullstack-forge integrations audit --json` when
  the CLI is installed.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review provider dashboards, quotas, and deprecation notices
- Confirm contractual retention and incident obligations

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-INTE-001`, `FF-INTE-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- Add explicit timeouts, payload validation, and secret redaction
- Pin a compatible SDK version after tests

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing provider, credentials, contractual data flow, or failure policy

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Replay signed and tampered payloads
- Simulate timeout, rate limit, and provider error responses

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- OWASP API Security Top 10 2023
- RFC 9110

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Prefer official SDK verification primitives while validating their configured options

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Provider-side state and contracts require external evidence

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
