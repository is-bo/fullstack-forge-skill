---
name: forge-notifications
description: "Inspect email, SMS, push, and in-app notifications for authorization, preferences, retries, privacy, and deliverability."
---

# forge-notifications: Notifications

Engine: Forge native

## Purpose

Inspect email, SMS, push, and in-app notifications for authorization, preferences, retries, privacy, and deliverability.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" notifications compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Activate when a request or direct repository evidence involves notifications, when
the user explicitly names `forge-notifications`, or when discovery proves an applicable boundary.

- Transactional, security, lifecycle, or marketing messages

## When not to activate

- No outbound or in-product notification system

## Automated support

Relevant discovery inputs are:

- message producers and templates
- preference model
- provider integrations

Deterministic support, bounded evidence only:

- `inspect-routes`

## Agent inspection procedure

1. Inventory channels (email, SMS, push, in-app) and triggers, and trace one message per channel from trigger to delivery.
2. Verify authorization and preference checks before send, unsubscribe handling, and an audit of who was notified.
3. Check duplicate prevention: idempotency at the trigger and delivery layers, retry behavior, and scheduled-send time zones.
4. Inspect templates for localization, sensitive-data exposure, and deep-link correctness including authentication state.
5. Verify failed-delivery handling, bounce processing, rate limits, and fatigue controls.

Manual inspection requirements:

- Review content accuracy, accessibility, and deliverability settings
- Confirm legally required and user-controlled preference semantics

Stack-specific guidance:

- Treat provider webhooks as hostile signed input and make handlers idempotent

## Evidence to collect

Standards used as criteria:

- OWASP ASVS 5.0
- RFC 8058
- WCAG 2.2

## Common production failures

- Trace trigger, recipient authorization, template data, locale, channel selection, send, webhook, and state update
- Inspect idempotency, deduplication, rate limits, quiet hours, retry, expiry, unsubscribe, suppression, and bounce handling
- Check sensitive preview content, deep links, spoof resistance, preference overrides, tenant isolation, and provider secrets

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add deduplication keys, expiry, and sensitive-data redaction
- Correct accessible template markup

## Approval-required changes

- Changing mandatory-message policy, consent, sender identity, or provider

## Verification

- Send to controlled sinks and trace provider callbacks
- Exercise duplicate, stale, opted-out, bounced, and cross-tenant cases

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Deliverability and carrier behavior require provider evidence
