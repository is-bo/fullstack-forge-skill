---
name: forge-recovery
description: Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios. Activate automatically for durable production data or stateful critical services when that concern is relevant to a software-engineering request.
---

# forge-recovery: Backup and recovery

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

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

Deterministic support, bounded evidence only:

- `inspect-database-schema`
- `inspect-deployment-config`

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

Standards used as criteria:

- NIST SP 800-34
- CIS Controls data-recovery guidance

## Common production failures

- Map every durable store, object, secret, configuration, and external dependency to backup ownership
- Inspect frequency, retention, encryption, immutability, isolation, monitoring, restore order, schema compatibility, and credentials
- Compare RPO/RTO targets with tested restore timings and dependencies

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Correct runbook steps and add backup monitoring
- Add restore validation to an isolated test environment

## Approval-required changes

- Deleting backups, changing retention, or initiating production failover

## Verification

- Perform an isolated restore and application integrity check
- Record actual recovery point and elapsed time

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- A configured backup without a tested restore is NOT_VERIFIED
