---
name: forge-database
description: Inspect schema integrity, migrations, constraints, tenancy, lifecycle, recovery, and production-safe evolution. Activate automatically for applications with a database or durable structured store when that concern is relevant to a software-engineering request.
---

# forge-database: Database design

Engine: Hybrid — Forge + Supabase, wshobson, Google

## Purpose

Inspect schema integrity, migrations, constraints, tenancy, lifecycle, recovery, and production-safe evolution.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves database design, when
the user explicitly names `forge-database`, or when discovery proves an applicable boundary.

- Applications with a database or durable structured store

## When not to activate

- Stateless applications proven to store no durable data

## Automated support

Relevant discovery inputs are:

- schema and migrations
- ORM metadata
- database configuration and tests

Deterministic support, bounded evidence only:

- `inspect-database-schema`

## Agent inspection procedure

1. Read the schema (migrations, ORM models, or live catalog) and verify primary keys, foreign keys, unique constraints, and nullability against the domain rules.
2. Check types for money (integer minor units or decimal), timestamps (time-zone aware), enums (evolution path), and identifiers.
3. Trace referential integrity and cascade behavior for deletion paths, including soft-deletion consistency.
4. Review the migration history for destructive operations, lock-heavy changes on large tables, and reversibility.
5. Verify tenant-scoping columns and indexes, audit fields, and database-level permissions against least privilege.

Manual inspection requirements:

- Review applied production migration state and large-table risk with operators
- Confirm restore objectives and managed-database settings

Stack-specific guidance:

- Inspect generated SQL and actual constraints, not ORM declarations alone

## Evidence to collect

Standards used as criteria:

- PostgreSQL current documentation
- OWASP Database Security Cheat Sheet

## Common production failures

- Inspect keys, types, nullability, defaults, foreign keys, uniqueness, checks, indexes, and cascade behavior
- Review migration ordering, transactional safety, locks, backfills, expand-contract compatibility, and rollback or forward-fix strategy
- Trace tenant isolation, encryption, retention, audit fields, soft deletion, and backup expectations

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add documentation and tests for existing constraints
- Create a new unapplied safe migration when lock and compatibility risk is understood

## Approval-required changes

- Editing applied migrations, dropping data, changing ownership, or rewriting architecture

## Verification

- Apply migrations to an empty and representative upgraded database
- Run integrity and rollback/forward-fix tests

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Production row counts, locks, and plans cannot be inferred
