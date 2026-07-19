---
name: forge-payments
description: Audit money movement, pricing, entitlements, provider events, reconciliation, idempotency, and sensitive data boundaries. Use for payments, billing, subscriptions, refunds, credits, invoices, or financial ledgers.
---

# forge-payments: Payments

## Purpose

Audit money movement, pricing, entitlements, provider events, reconciliation, idempotency, and sensitive data boundaries.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-payments`, asks about payments, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Payments, billing, subscriptions, refunds, credits, invoices, or financial ledgers

## When it does not apply

- No money, stored value, pricing, or paid entitlement

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- payment routes and provider integration
- pricing and ledger models
- webhook handlers

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Trace amount determination: every charge, refund, and credit derives from server-owned records, never client input.
3. Verify precision: minor-unit or decimal arithmetic, documented rounding, and tax and discount ordering.
4. Inspect webhooks: raw-byte signature verification before parsing, durable event-ID idempotency before side effects, and out-of-order tolerance.
5. Map the payment state machine: legal transitions, partial-failure recovery, and reconciliation against provider records.
6. Check test/live separation, sensitive-data boundaries (hosted fields), refund and dispute paths, and the audit trail for money movement.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

- Trace quote-to-entitlement and refund/dispute flows with currency and minor-unit handling
- Inspect server-authoritative amounts, idempotency, webhook raw-body signatures, replay defense, ordering, duplicate events, state machines, and reconciliation
- Check authorization, audit trails, secrets, hosted-field boundaries, tax/discount rounding, negative amounts, and failure recovery

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Server-side amount calculation
- Currency precision
- Rounding
- Webhook signatures
- Idempotency
- Duplicate payments
- Reconciliation
- Refunds
- Partial failures
- Payment state machines
- Client-side tampering
- Test and live separation
- Sensitive data
- Audit trails
- Replay attacks
- Price changes
- Subscription transitions
- Chargeback handling
- Webhook ordering

## Safe executable checks

- Run `forge payments audit --json` or `fullstack-forge payments audit --json` when
  the CLI is installed.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review provider dashboard settings and sample reconciliations
- Obtain qualified compliance and financial review where applicable

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-PAYM-001`, `FF-PAYM-002`, and so on. Preserve an ID across
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

- Add idempotency storage, explicit currency validation, and duplicate-event tests
- Redact payment identifiers from logs

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing financial calculations, prices, ledgers, provider, settlement, or entitlement semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run sandbox success, duplicate, timeout, delayed webhook, refund, and dispute scenarios
- Reconcile provider, internal ledger, and granted entitlement

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- OWASP Third Party Payment Gateway Integration Cheat Sheet
- PCI DSS scope concepts

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use provider-hosted collection where possible and never trust client-calculated amounts

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Do not claim PCI or financial compliance from a code audit

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
