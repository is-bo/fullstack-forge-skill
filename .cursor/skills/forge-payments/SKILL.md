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

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing financial calculations, prices, ledgers, provider, settlement, or entitlement semantics

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run sandbox success, duplicate, timeout, delayed webhook, refund, and dispute scenarios
- Reconcile provider, internal ledger, and granted entitlement

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Do not claim PCI or financial compliance from a code audit

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
