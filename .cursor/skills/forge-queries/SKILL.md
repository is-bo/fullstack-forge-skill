---
name: forge-queries
description: Find correctness, injection, overfetching, N+1, pagination, locking, and index-use risks in data access. Activate automatically for database, search, analytics, and remote query code when that concern is relevant to a software-engineering request.
---

# forge-queries: Query behavior

## Purpose

Find correctness, injection, overfetching, N+1, pagination, locking, and index-use risks in data access.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves query behavior, when
the user explicitly names `forge-queries`, or when discovery proves an applicable boundary.

- Database, search, analytics, and remote query code

## When not to activate

- Systems with no queryable data source

## Automated support

Relevant discovery inputs are:

- query call sites
- schema and indexes
- representative query plans when available

Available deterministic support, where present:

- Use `inspect-query-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Collect query call sites from ORM and driver evidence and identify the hot paths from routes and jobs.
2. Detect N+1 shapes: queries inside loops or per-row lazy loads, and verify batch or join alternatives.
3. Check every list query for bounds, a pagination strategy that holds at scale, and deterministic ordering with a tie-breaker.
4. Compare indexes against actual predicates and sort orders; flag missing, redundant, and unused indexes with schema evidence.
5. For critical PostgreSQL queries run `EXPLAIN (ANALYZE, BUFFERS)` against a safe non-production database only, and record the plans; inspect transaction length, lock scope, and connection-pool sizing.

Manual inspection requirements:

- Review real EXPLAIN output for high-impact queries
- Confirm data-distribution and concurrency assumptions

Stack-specific guidance:

- Account for ORM lazy loading, implicit transactions, and generated SQL

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- PostgreSQL index and EXPLAIN documentation
- OWASP Injection Prevention Cheat Sheet

## Common production failures

- Trace user-controlled values to parameterized query boundaries
- Detect N+1 patterns, unbounded reads, offset drift, incorrect joins, overfetching, missing ordering, and unsafe dynamic identifiers
- Review transactions, isolation, locks, timeouts, connection use, batching, and candidate indexes

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- N+1 queries
- Missing indexes
- Redundant indexes
- Unused indexes
- Full-table scans
- Unbounded lists
- Pagination
- Query selectivity
- Excessive SELECT star
- Duplicate queries
- Locking
- Long transactions
- Connection pooling
- Batch operations
- Query timeouts
- Sorting without indexes
- ORM-generated SQL
- Search implementation
- Expensive counts
- Bulk import performance
- Offset pagination at large scale
- Missing deterministic ordering
- Safe EXPLAIN (ANALYZE, BUFFERS) only on development or staging databases

## Commands and tools

- Run `forge queries audit --json` or `fullstack-forge queries audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Parameterize values, add explicit bounds, and select required columns
- Add a proven non-disruptive index through a new migration

## Approval-required changes

- Changing result semantics, isolation, production indexes, or query architecture

## Verification

- Run correctness tests with boundary and concurrent cases
- Compare measured plans before and after performance changes

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Never fabricate a query plan or production cardinality
