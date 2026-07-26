---
name: forge-privacy
description: Inspect personal-data inventory, purpose, minimization, consent, retention, access, deletion, export, and logging. Activate automatically for applications processing personal, device, behavioral, or sensitive data when that concern is relevant to a software-engineering request.
---

# forge-privacy: Privacy

## Purpose

Inspect personal-data inventory, purpose, minimization, consent, retention, access, deletion, export, and logging.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves privacy, when
the user explicitly names `forge-privacy`, or when discovery proves an applicable boundary.

- Applications processing personal, device, behavioral, or sensitive data

## When not to activate

- Systems proven to process no data linkable to a person

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- data inventory
- schemas
- analytics and integration flows
- privacy documentation

Available deterministic support, where present:

- Use `inspect-env-template` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory personal-data fields across the schema, logs, analytics, and third-party flows, and record the purpose for each.
3. Trace collection points against the stated purpose and flag fields collected without use or consent.
4. Verify retention: deletion paths for accounts and tenants actually remove or anonymize the data, including files, caches, backup policy, and analytics.
5. Inspect logging and error paths for personal data and verify redaction at the sink.
6. Check export and correction capabilities, third-party processor flows, and residency constraints against the documented policy.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Obtain qualified legal review for jurisdiction-specific obligations
- Confirm processor contracts and production retention settings

Stack-specific guidance:

- Inspect generated telemetry and managed-service defaults, not schemas alone

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

- NIST Privacy Framework
- OWASP User Privacy Protection Cheat Sheet

## Common production failures

- Map collection, purpose, legal basis or consent, storage, processors, transfer, retention, and deletion
- Inspect logs, analytics, backups, exports, support access, subject requests, and privacy defaults
- Verify sensitive fields are minimized, protected, and excluded from accidental telemetry

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Personal-data inventory
- Purpose for each field
- Data minimization
- Consent
- Retention
- Account deletion
- Tenant deletion
- Data export
- Data correction
- Sensitive-data classification
- Encryption
- Analytics tracking
- Log redaction
- Backups
- Development data
- Test data
- Third-party processors
- Data residency
- Privacy notices
- Children's data
- User rights
- Data-sharing behavior
- Whether data should be collected or retained at all

## Commands and tools

- Run `forge privacy audit --json` or `fullstack-forge privacy audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-env-template` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Redact unnecessary personal data from logs
- Document a verified data-flow or retention control

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing consent, retention, deletion, data sharing, or legal representations

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Trace representative data through create, access, export, deletion, and backup handling
- Confirm telemetry does not receive prohibited fields

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

- Do not provide legal conclusions; mark missing policy evidence NOT_VERIFIED

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
