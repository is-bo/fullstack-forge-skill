---
name: forge-privacy
description: "Inspect personal-data inventory, purpose, minimization, consent, retention, access, deletion, export, and logging."
---

# forge-privacy: Privacy

Engine: Forge native

## Purpose

Inspect personal-data inventory, purpose, minimization, consent, retention, access, deletion, export, and logging.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" privacy compose --workflow audit --root "<repository-root>" --dry-run --json`

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
