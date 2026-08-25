---
name: forge-recovery
description: "Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios."
---

# forge-recovery: Backup and recovery

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Sentry, Google

## Purpose

Verify recoverability of data and service against explicit RPO, RTO, corruption, deletion, and regional scenarios.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" recovery compose --workflow audit --root "<repository-root>" --dry-run --json`

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
