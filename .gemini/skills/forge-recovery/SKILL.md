---
name: forge-recovery
description: Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios. Use for durable production data or stateful critical services.
---

# forge-recovery: Backup and recovery

## Purpose

Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-recovery`, asks about backup and recovery, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Durable production data or stateful critical services

## When it does not apply

- Reproducible stateless artifacts with no unique data

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- data inventory
- backup configuration
- restore and disaster runbooks

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory data stores and their backup mechanisms, schedules, encryption, and retention from configuration evidence.
3. Verify restoration directly: find evidence of a successful recent restore test; without it, backups are `NOT_VERIFIED`, never `PASS`.
4. Trace point-in-time recovery capability and measure claimed RPO and RTO against configuration reality.
5. Check failure scenarios: accidental deletion, ransomware (immutable or offline copies), regional loss, and secret or infrastructure recreation.
6. Inspect runbooks for executability — could the on-call engineer actually follow them — and record drill history and ownership.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

- Map every durable store, object, secret, configuration, and external dependency to backup ownership
- Inspect frequency, retention, encryption, immutability, isolation, monitoring, restore order, schema compatibility, and credentials
- Compare RPO/RTO targets with tested restore timings and dependencies

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Database backups
- Object-storage backups
- Backup encryption
- Retention
- Restoration testing
- Recovery point objective
- Recovery time objective
- Point-in-time recovery
- Geographic failure
- Accidental deletion
- Ransomware considerations
- Secret recovery
- Infrastructure recreation
- Runbooks
- Ownership
- Scheduled recovery drills
- NOT_VERIFIED rather than PASS when restoration lacks direct evidence

## Safe executable checks

- Run `forge recovery audit --json` or `fullstack-forge recovery audit --json` when
  the CLI is installed.
- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review recent restore evidence and incident communications
- Confirm managed-service backup and regional failover settings

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-RECO-001`, `FF-RECO-002`, and so on. Preserve an ID across
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

- Correct runbook steps and add backup monitoring
- Add restore validation to an isolated test environment

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Deleting backups, changing retention, or initiating production failover

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Perform an isolated restore and application integrity check
- Record actual recovery point and elapsed time

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- NIST SP 800-34
- CIS Controls data-recovery guidance

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Restore application, schema, objects, queues, and secrets in dependency order

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- A configured backup without a tested restore is NOT_VERIFIED

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
