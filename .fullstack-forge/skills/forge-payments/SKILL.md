---
name: forge-payments
description: Audit money movement, pricing, entitlements, provider events, reconciliation, idempotency, and sensitive data boundaries. Activate automatically for payments, billing, subscriptions, refunds, credits, invoices, or financial ledgers when that concern is relevant to a software-engineering request.
---

# forge-payments: Payments

Engine: Hybrid — Forge + wshobson

## Purpose

Audit money movement, pricing, entitlements, provider events, reconciliation, idempotency, and sensitive data boundaries.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves payments, when
the user explicitly names `forge-payments`, or when discovery proves an applicable boundary.

- Payments, billing, subscriptions, refunds, credits, invoices, or financial ledgers

## When not to activate

- No money, stored value, pricing, or paid entitlement

## Automated support

Relevant discovery inputs are:

- payment routes and provider integration
- pricing and ledger models
- webhook handlers

Deterministic support, bounded evidence only:

- `inspect-routes`

## Agent inspection procedure

1. Trace amount determination: every charge, refund, and credit derives from server-owned records, never client input.
2. Verify precision: minor-unit or decimal arithmetic, documented rounding, and tax and discount ordering.
3. Inspect webhooks: raw-byte signature verification before parsing, durable event-ID idempotency before side effects, and out-of-order tolerance.
4. Map the payment state machine: legal transitions, partial-failure recovery, and reconciliation against provider records.
5. Check test/live separation, sensitive-data boundaries (hosted fields), refund and dispute paths, and the audit trail for money movement.

Manual inspection requirements:

- Review provider dashboard settings and sample reconciliations
- Obtain qualified compliance and financial review where applicable

Stack-specific guidance:

- Use provider-hosted collection where possible and never trust client-calculated amounts

## Evidence to collect

Standards used as criteria:

- OWASP Third Party Payment Gateway Integration Cheat Sheet
- PCI DSS scope concepts

## Common production failures

- Trace quote-to-entitlement and refund/dispute flows with currency and minor-unit handling
- Inspect server-authoritative amounts, idempotency, webhook raw-body signatures, replay defense, ordering, duplicate events, state machines, and reconciliation
- Check authorization, audit trails, secrets, hosted-field boundaries, tax/discount rounding, negative amounts, and failure recovery

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add idempotency storage, explicit currency validation, and duplicate-event tests
- Redact payment identifiers from logs

## Approval-required changes

- Changing financial calculations, prices, ledgers, provider, settlement, or entitlement semantics

## Verification

- Run sandbox success, duplicate, timeout, delayed webhook, refund, and dispute scenarios
- Reconcile provider, internal ledger, and granted entitlement

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Do not claim PCI or financial compliance from a code audit
