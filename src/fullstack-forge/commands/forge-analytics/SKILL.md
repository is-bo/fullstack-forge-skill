---
name: forge-analytics
description: Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness. Activate automatically for product, marketing, operational, or experimentation analytics when that concern is relevant to a software-engineering request.
---

# forge-analytics: Analytics

Engine: Hybrid — Forge + Google

## Purpose

Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

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

Deterministic support, bounded evidence only:

- `inspect-routes`

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

Standards used as criteria:

- NIST Privacy Framework
- W3C Data Privacy Vocabulary concepts

## Common production failures

- Map each event to a decision, owner, schema, trigger, identity, consent state, and retention
- Inspect duplicate delivery, ordering, retries, offline queues, bot/internal traffic, versioning, and schema validation
- Check personal and sensitive fields, tenant boundaries, deletion propagation, access, and experimentation exposure

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Remove prohibited fields and add schema validation
- Document and de-duplicate a clearly defined event

## Approval-required changes

- Adding tracking, changing consent, identity stitching, retention, or metric definitions

## Verification

- Trigger one action and trace its exact event through the pipeline
- Test consent denied, offline, retry, and deletion paths

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Warehouse correctness needs sampled destination evidence
