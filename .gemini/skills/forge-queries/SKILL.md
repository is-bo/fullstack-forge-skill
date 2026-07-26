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

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

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

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing result semantics, isolation, production indexes, or query architecture

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run correctness tests with boundary and concurrent cases
- Compare measured plans before and after performance changes

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

- Never fabricate a query plan or production cardinality

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
