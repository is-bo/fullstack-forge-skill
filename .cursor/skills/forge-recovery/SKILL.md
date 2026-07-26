---
name: forge-recovery
description: Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios. Activate automatically for durable production data or stateful critical services when that concern is relevant to a software-engineering request.
---

# forge-recovery: Backup and recovery

## Purpose

Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves backup and recovery, when
the user explicitly names `forge-recovery`, or when discovery proves an applicable boundary.

- Durable production data or stateful critical services

## When not to activate

- Reproducible stateless artifacts with no unique data

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- data inventory
- backup configuration
- restore and disaster runbooks

Available deterministic support, where present:

- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

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

Manual inspection requirements:

- Review recent restore evidence and incident communications
- Confirm managed-service backup and regional failover settings

Stack-specific guidance:

- Restore application, schema, objects, queues, and secrets in dependency order

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

- NIST SP 800-34
- CIS Controls data-recovery guidance

## Common production failures

- Map every durable store, object, secret, configuration, and external dependency to backup ownership
- Inspect frequency, retention, encryption, immutability, isolation, monitoring, restore order, schema compatibility, and credentials
- Compare RPO/RTO targets with tested restore timings and dependencies

## Missing-control checks

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

## Commands and tools

- Run `forge recovery audit --json` or `fullstack-forge recovery audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Correct runbook steps and add backup monitoring
- Add restore validation to an isolated test environment

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Deleting backups, changing retention, or initiating production failover

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Perform an isolated restore and application integrity check
- Record actual recovery point and elapsed time

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

- A configured backup without a tested restore is NOT_VERIFIED

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
