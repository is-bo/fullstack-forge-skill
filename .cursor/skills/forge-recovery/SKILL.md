---
name: forge-recovery
description: Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios. Activate automatically for durable production data or stateful critical services when that concern is relevant to a software-engineering request.
---

# forge-recovery: Backup and recovery

## Purpose

Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves backup and recovery, when
the user explicitly names `forge-recovery`, or when discovery proves an applicable boundary.

- Durable production data or stateful critical services

## When not to activate

- Reproducible stateless artifacts with no unique data

## Automated support

Relevant discovery inputs are:

- data inventory
- backup configuration
- restore and disaster runbooks

Available deterministic support, where present:

- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Inventory data stores and their backup mechanisms, schedules, encryption, and retention from configuration evidence.
2. Verify restoration directly: find evidence of a successful recent restore test; without it, backups are `NOT_VERIFIED`, never `PASS`.
3. Trace point-in-time recovery capability and measure claimed RPO and RTO against configuration reality.
4. Check failure scenarios: accidental deletion, ransomware (immutable or offline copies), regional loss, and secret or infrastructure recreation.
5. Inspect runbooks for executability — could the on-call engineer actually follow them — and record drill history and ownership.

Manual inspection requirements:

- Review recent restore evidence and incident communications
- Confirm managed-service backup and regional failover settings

Stack-specific guidance:

- Restore application, schema, objects, queues, and secrets in dependency order

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Correct runbook steps and add backup monitoring
- Add restore validation to an isolated test environment

## Approval-required changes

- Deleting backups, changing retention, or initiating production failover

## Verification

- Perform an isolated restore and application integrity check
- Record actual recovery point and elapsed time

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- A configured backup without a tested restore is NOT_VERIFIED
