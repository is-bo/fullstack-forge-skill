---
name: forge-analytics
description: Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness. Use for product, marketing, operational, or experimentation analytics.
---

# forge-analytics: Analytics

## Purpose

Audit event semantics, consent, data quality, identity, privacy, delivery, and decision usefulness.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-analytics`, asks about analytics, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Product, marketing, operational, or experimentation analytics

## When it does not apply

- No analytics collection or derived behavioral data

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- event taxonomy
- tracking code
- consent and destination configuration

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

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

### Concrete checks

- Map each event to a decision, owner, schema, trigger, identity, consent state, and retention
- Inspect duplicate delivery, ordering, retries, offline queues, bot/internal traffic, versioning, and schema validation
- Check personal and sensitive fields, tenant boundaries, deletion propagation, access, and experimentation exposure

## Required inspection criteria

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

## Safe executable checks

- Run `forge analytics audit --json` or `fullstack-forge analytics audit --json` when
  the CLI is installed.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Compare sample warehouse events with source actions
- Review metric definitions and consent behavior with owners

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-ANAL-001`, `FF-ANAL-002`, and so on. Preserve an ID across
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

- Remove prohibited fields and add schema validation
- Document and de-duplicate a clearly defined event

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Adding tracking, changing consent, identity stitching, retention, or metric definitions

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Trigger one action and trace its exact event through the pipeline
- Test consent denied, offline, retry, and deletion paths

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- NIST Privacy Framework
- W3C Data Privacy Vocabulary concepts

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Separate server and client identity sources and avoid embedding secrets

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Warehouse correctness needs sampled destination evidence

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
