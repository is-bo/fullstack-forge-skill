---
name: forge-queries
description: Find correctness, injection, overfetching, N+1, pagination, locking, and index-use risks in data access. Activate automatically for database, search, analytics, and remote query code when that concern is relevant to a software-engineering request.
---

# forge-queries: Query behavior

## Purpose

Find correctness, injection, overfetching, N+1, pagination, locking, and index-use risks in data access.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves query behavior, when
the user explicitly names `forge-queries`, or when discovery proves an applicable boundary.

- Database, search, analytics, and remote query code

## When not to activate

- Systems with no queryable data source

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- query call sites
- schema and indexes
- representative query plans when available

Available deterministic support, where present:

- Use `inspect-query-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Collect query call sites from ORM and driver evidence and identify the hot paths from routes and jobs.
3. Detect N+1 shapes: queries inside loops or per-row lazy loads, and verify batch or join alternatives.
4. Check every list query for bounds, a pagination strategy that holds at scale, and deterministic ordering with a tie-breaker.
5. Compare indexes against actual predicates and sort orders; flag missing, redundant, and unused indexes with schema evidence.
6. For critical PostgreSQL queries run `EXPLAIN (ANALYZE, BUFFERS)` against a safe non-production database only, and record the plans; inspect transaction length, lock scope, and connection-pool sizing.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review real EXPLAIN output for high-impact queries
- Confirm data-distribution and concurrency assumptions

Stack-specific guidance:

- Account for ORM lazy loading, implicit transactions, and generated SQL

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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
- Use `inspect-query-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Parameterize values, add explicit bounds, and select required columns
- Add a proven non-disruptive index through a new migration

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing result semantics, isolation, production indexes, or query architecture

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run correctness tests with boundary and concurrent cases
- Compare measured plans before and after performance changes

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Never fabricate a query plan or production cardinality

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
