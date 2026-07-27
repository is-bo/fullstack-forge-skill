---
name: forge-privacy
description: Inspect personal-data inventory, purpose, minimization, consent, retention, access, deletion, export, and logging. Activate automatically for applications processing personal, device, behavioral, or sensitive data when that concern is relevant to a software-engineering request.
---

# forge-privacy: Privacy

## Purpose

Inspect personal-data inventory, purpose, minimization, consent, retention, access, deletion, export, and logging.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves privacy, when
the user explicitly names `forge-privacy`, or when discovery proves an applicable boundary.

- Applications processing personal, device, behavioral, or sensitive data

## When not to activate

- Systems proven to process no data linkable to a person

## Automated support

Relevant discovery inputs are:

- data inventory
- schemas
- analytics and integration flows
- privacy documentation

Deterministic support, bounded evidence only:

- `inspect-env-template`
- `scan-secret-patterns`

## Agent inspection procedure

1. Inventory personal-data fields across the schema, logs, analytics, and third-party flows, and record the purpose for each.
2. Trace collection points against the stated purpose and flag fields collected without use or consent.
3. Verify retention: deletion paths for accounts and tenants actually remove or anonymize the data, including files, caches, backup policy, and analytics.
4. Inspect logging and error paths for personal data and verify redaction at the sink.
5. Check export and correction capabilities, third-party processor flows, and residency constraints against the documented policy.

Manual inspection requirements:

- Obtain qualified legal review for jurisdiction-specific obligations
- Confirm processor contracts and production retention settings

Stack-specific guidance:

- Inspect generated telemetry and managed-service defaults, not schemas alone

## Evidence to collect

Standards used as criteria:

- NIST Privacy Framework
- OWASP User Privacy Protection Cheat Sheet

## Common production failures

- Map collection, purpose, legal basis or consent, storage, processors, transfer, retention, and deletion
- Inspect logs, analytics, backups, exports, support access, subject requests, and privacy defaults
- Verify sensitive fields are minimized, protected, and excluded from accidental telemetry

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Redact unnecessary personal data from logs
- Document a verified data-flow or retention control

## Approval-required changes

- Changing consent, retention, deletion, data sharing, or legal representations

## Verification

- Trace representative data through create, access, export, deletion, and backup handling
- Confirm telemetry does not receive prohibited fields

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Do not provide legal conclusions; mark missing policy evidence NOT_VERIFIED
