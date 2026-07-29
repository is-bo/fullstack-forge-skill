---
name: forge-tenancy
description: Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration. Activate automatically for shared applications serving distinct organizations or customer partitions when that concern is relevant to a software-engineering request.
---

# forge-tenancy: Multi-tenancy

Engine: Forge native

## Purpose

Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration.


## Deterministic runtime composition

Before loading any provider procedure, run:

`node .fullstack-forge/runtime/cli/src/composition-entry.js tenancy compose --root <repository-root> --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. Read `.forge/composition.json`, keep the Forge
contract at index zero, and load only the ordered `selected` runtime paths. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback.


Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves multi-tenancy, when
the user explicitly names `forge-tenancy`, or when discovery proves an applicable boundary.

- Shared applications serving distinct organizations or customer partitions

## When not to activate

- Single-tenant deployments with no shared data plane

## Automated support

Relevant discovery inputs are:

- tenant model
- authorization policies
- queries, cache keys, storage paths, and jobs

Deterministic support, bounded evidence only:

- `inspect-authorization`
- `inspect-database-schema`
- `inspect-cache-usage`

## Agent inspection procedure

1. Locate the tenant identifier's origin and verify it derives from authenticated identity, never from request input.
2. Trace tenant-context propagation through every data query, verifying the tenant predicate at the final data-access boundary.
3. Check isolation beyond the database: cache keys, file paths, background jobs, logs, metrics, and search indexes.
4. Inspect unique constraints and identifiers for tenant scoping, and admin or support access for explicit cross-tenant audit trails.
5. Run or demand negative tests: the same object identifier across two tenants on every access path, including exports and downloads.

Manual inspection requirements:

- Review provisioning, suspension, migration, deletion, and break-glass flows
- Validate database and provider isolation settings

Stack-specific guidance:

- Ensure ORM helpers cannot be bypassed by raw queries or background workers

## Evidence to collect

Standards used as criteria:

- OWASP Multi Tenant Security Cheat Sheet
- OWASP Authorization Cheat Sheet

## Common production failures

- Identify the trusted tenant-context source and follow it through every boundary
- Test missing, forged, stale, and cross-tenant identifiers in reads, writes, bulk actions, exports, jobs, and websockets
- Inspect composite uniqueness, row policies, cache namespaces, object prefixes, logs, and support tooling

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Tenant identifiers
- Tenant propagation
- Query scoping
- Cache-key isolation
- File-path isolation
- Object-storage isolation
- Background jobs
- Scheduled jobs
- Logs
- Metrics
- Unique constraints
- Exports
- Admin access
- Billing ownership
- Tenant deletion
- Shared resources
- Tenant-specific secrets
- Tenant-specific rate limits
- Cross-tenant testing
- Active negative tests for cross-tenant access

## Commands and tools

- Run `forge tenancy audit --json` or `fullstack-forge tenancy audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Add tenant-scoped tests and explicit cache-key namespaces
- Reject missing tenant context at an existing boundary

## Approval-required changes

- Changing tenant identifiers, isolation strategy, or support access

## Verification

- Run cross-tenant negative tests for every critical resource
- Confirm asynchronous work restores trusted tenant context

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Infrastructure-level isolation requires live configuration evidence
