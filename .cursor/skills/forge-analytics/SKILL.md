---
name: forge-analytics
description: Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness. Activate automatically for product, marketing, operational, or experimentation analytics when that concern is relevant to a software-engineering request.
---

# forge-analytics: Analytics

## Purpose

Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves analytics, when
the user explicitly names `forge-analytics`, or when discovery proves an applicable boundary.

- Product, marketing, operational, or experimentation analytics

## When not to activate

- No analytics collection or derived behavioral data

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- event taxonomy
- tracking code
- consent and destination configuration

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory tracked events against the naming schema and record duplicates, orphans, and gaps in critical funnels.
3. Trace identity handling: anonymous-to-authenticated merging, cross-device behavior, and tenant properties.
4. Verify consent gating for regions that require it and check events for sensitive-data leakage.
5. Compare client-side and server-side event reliability for revenue-critical metrics.
6. Check schema versioning, validation at ingestion, and whether success, error, and abandonment events cover the decisions the product needs.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Compare sample warehouse events with source actions
- Review metric definitions and consent behavior with owners

Stack-specific guidance:

- Separate server and client identity sources and avoid embedding secrets

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Remove prohibited fields and add schema validation
- Document and de-duplicate a clearly defined event

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Adding tracking, changing consent, identity stitching, retention, or metric definitions

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Trigger one action and trace its exact event through the pipeline
- Test consent denied, offline, retry, and deletion paths

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Warehouse correctness needs sampled destination evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
