---
name: forge-notifications
description: Inspect email, SMS, push, and in-app notifications for authorization, preferences, retries, privacy, and deliverability. Activate automatically for transactional, security, lifecycle, or marketing messages when that concern is relevant to a software-engineering request.
---

# forge-notifications: Notifications

## Purpose

Inspect email, SMS, push, and in-app notifications for authorization, preferences, retries, privacy, and deliverability.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves notifications, when
the user explicitly names `forge-notifications`, or when discovery proves an applicable boundary.

- Transactional, security, lifecycle, or marketing messages

## When not to activate

- No outbound or in-product notification system

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- message producers and templates
- preference model
- provider integrations

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory channels (email, SMS, push, in-app) and triggers, and trace one message per channel from trigger to delivery.
3. Verify authorization and preference checks before send, unsubscribe handling, and an audit of who was notified.
4. Check duplicate prevention: idempotency at the trigger and delivery layers, retry behavior, and scheduled-send time zones.
5. Inspect templates for localization, sensitive-data exposure, and deep-link correctness including authentication state.
6. Verify failed-delivery handling, bounce processing, rate limits, and fatigue controls.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review content accuracy, accessibility, and deliverability settings
- Confirm legally required and user-controlled preference semantics

Stack-specific guidance:

- Treat provider webhooks as hostile signed input and make handlers idempotent

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- OWASP ASVS 5.0
- RFC 8058
- WCAG 2.2

## Common production failures

- Trace trigger, recipient authorization, template data, locale, channel selection, send, webhook, and state update
- Inspect idempotency, deduplication, rate limits, quiet hours, retry, expiry, unsubscribe, suppression, and bounce handling
- Check sensitive preview content, deep links, spoof resistance, preference overrides, tenant isolation, and provider secrets

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Email delivery
- Templates
- Localization
- Unsubscribe behavior
- Notification preferences
- Duplicate sends
- Retry logic
- Scheduled delivery
- Time zones
- Sensitive information
- Deep links
- Failed delivery
- Push permissions
- Rate limits
- Notification fatigue
- Idempotency

## Commands and tools

- Run `forge notifications audit --json` or `fullstack-forge notifications audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add deduplication keys, expiry, and sensitive-data redaction
- Correct accessible template markup

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing mandatory-message policy, consent, sender identity, or provider

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Send to controlled sinks and trace provider callbacks
- Exercise duplicate, stale, opted-out, bounced, and cross-tenant cases

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Deliverability and carrier behavior require provider evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
