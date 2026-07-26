---
name: forge-payments
description: Audit money movement, pricing, entitlements, provider events, reconciliation, idempotency, and sensitive data boundaries. Activate automatically for payments, billing, subscriptions, refunds, credits, invoices, or financial ledgers when that concern is relevant to a software-engineering request.
---

# forge-payments: Payments

## Purpose

Audit money movement, pricing, entitlements, provider events, reconciliation, idempotency, and sensitive data boundaries.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves payments, when
the user explicitly names `forge-payments`, or when discovery proves an applicable boundary.

- Payments, billing, subscriptions, refunds, credits, invoices, or financial ledgers

## When not to activate

- No money, stored value, pricing, or paid entitlement

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- payment routes and provider integration
- pricing and ledger models
- webhook handlers

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

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

Manual inspection requirements:

- Review provider dashboard settings and sample reconciliations
- Obtain qualified compliance and financial review where applicable

Stack-specific guidance:

- Use provider-hosted collection where possible and never trust client-calculated amounts

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

- OWASP Third Party Payment Gateway Integration Cheat Sheet
- PCI DSS scope concepts

## Common production failures

- Trace quote-to-entitlement and refund/dispute flows with currency and minor-unit handling
- Inspect server-authoritative amounts, idempotency, webhook raw-body signatures, replay defense, ordering, duplicate events, state machines, and reconciliation
- Check authorization, audit trails, secrets, hosted-field boundaries, tax/discount rounding, negative amounts, and failure recovery

## Missing-control checks

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

## Commands and tools

- Run `forge payments audit --json` or `fullstack-forge payments audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add idempotency storage, explicit currency validation, and duplicate-event tests
- Redact payment identifiers from logs

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing financial calculations, prices, ledgers, provider, settlement, or entitlement semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run sandbox success, duplicate, timeout, delayed webhook, refund, and dispute scenarios
- Reconcile provider, internal ledger, and granted entitlement

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

- Do not claim PCI or financial compliance from a code audit

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
