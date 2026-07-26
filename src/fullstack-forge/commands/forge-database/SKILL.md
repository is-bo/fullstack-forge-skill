---
name: forge-database
description: Inspect schema integrity, migrations, constraints, tenancy, lifecycle, recovery, and production-safe evolution. Activate automatically for applications with a database or durable structured store when that concern is relevant to a software-engineering request.
---

# forge-database: Database design

## Purpose

Inspect schema integrity, migrations, constraints, tenancy, lifecycle, recovery, and production-safe evolution.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves database design, when
the user explicitly names `forge-database`, or when discovery proves an applicable boundary.

- Applications with a database or durable structured store

## When not to activate

- Stateless applications proven to store no durable data

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- schema and migrations
- ORM metadata
- database configuration and tests

Available deterministic support, where present:

- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Read the schema (migrations, ORM models, or live catalog) and verify primary keys, foreign keys, unique constraints, and nullability against the domain rules.
3. Check types for money (integer minor units or decimal), timestamps (time-zone aware), enums (evolution path), and identifiers.
4. Trace referential integrity and cascade behavior for deletion paths, including soft-deletion consistency.
5. Review the migration history for destructive operations, lock-heavy changes on large tables, and reversibility.
6. Verify tenant-scoping columns and indexes, audit fields, and database-level permissions against least privilege.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review applied production migration state and large-table risk with operators
- Confirm restore objectives and managed-database settings

Stack-specific guidance:

- Inspect generated SQL and actual constraints, not ORM declarations alone

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

- PostgreSQL current documentation
- OWASP Database Security Cheat Sheet

## Common production failures

- Inspect keys, types, nullability, defaults, foreign keys, uniqueness, checks, indexes, and cascade behavior
- Review migration ordering, transactional safety, locks, backfills, expand-contract compatibility, and rollback or forward-fix strategy
- Trace tenant isolation, encryption, retention, audit fields, soft deletion, and backup expectations

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Primary keys
- Foreign keys
- Unique constraints
- Check constraints
- Nullability
- Normalization
- Intentional denormalization
- Cascade behavior
- Data types
- Money representation
- Date representation
- Time zones
- Enum evolution
- Audit fields
- Soft deletion
- Tenant scoping
- Migration history
- Referential integrity
- Database permissions
- Data retention
- Large-table evolution
- Migration safety
- Rollback implications

## Commands and tools

- Run `forge database audit --json` or `fullstack-forge database audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add documentation and tests for existing constraints
- Create a new unapplied safe migration when lock and compatibility risk is understood

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Editing applied migrations, dropping data, changing ownership, or rewriting architecture

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Apply migrations to an empty and representative upgraded database
- Run integrity and rollback/forward-fix tests

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

- Production row counts, locks, and plans cannot be inferred

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
