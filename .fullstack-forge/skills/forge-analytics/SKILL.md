---
name: forge-analytics
description: Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness. Activate automatically for product, marketing, operational, or experimentation analytics when that concern is relevant to a software-engineering request.
---

# forge-analytics: Analytics

## Purpose

Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves analytics, when
the user explicitly names `forge-analytics`, or when discovery proves an applicable boundary.

- Product, marketing, operational, or experimentation analytics

## When not to activate

- No analytics collection or derived behavioral data

## Automated support

Relevant discovery inputs are:

- event taxonomy
- tracking code
- consent and destination configuration

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Inventory tracked events against the naming schema and record duplicates, orphans, and gaps in critical funnels.
2. Trace identity handling: anonymous-to-authenticated merging, cross-device behavior, and tenant properties.
3. Verify consent gating for regions that require it and check events for sensitive-data leakage.
4. Compare client-side and server-side event reliability for revenue-critical metrics.
5. Check schema versioning, validation at ingestion, and whether success, error, and abandonment events cover the decisions the product needs.

Manual inspection requirements:

- Compare sample warehouse events with source actions
- Review metric definitions and consent behavior with owners

Stack-specific guidance:

- Separate server and client identity sources and avoid embedding secrets

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- NIST Privacy Framework
- W3C Data Privacy Vocabulary concepts

## Common production failures

- Map each event to a decision, owner, schema, trigger, identity, consent state, and retention
- Inspect duplicate delivery, ordering, retries, offline queues, bot/internal traffic, versioning, and schema validation
- Check personal and sensitive fields, tenant boundaries, deletion propagation, access, and experimentation exposure

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Event naming
- Event duplication
- Missing success events
- Funnel coverage
- Identity handling
- Anonymous and authenticated identity merging
- Tenant properties
- Sensitive data
- Consent
- Retention metrics
- Error events
- Abandonment events
- Server-side versus client-side events
- Analytics reliability
- Schema versioning
- Event validation

## Commands and tools

- Run `forge analytics audit --json` or `fullstack-forge analytics audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Remove prohibited fields and add schema validation
- Document and de-duplicate a clearly defined event

## Approval-required changes

- Adding tracking, changing consent, identity stitching, retention, or metric definitions

## Verification

- Trigger one action and trace its exact event through the pipeline
- Test consent denied, offline, retry, and deletion paths

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Warehouse correctness needs sampled destination evidence
