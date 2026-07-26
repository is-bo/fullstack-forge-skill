---
name: forge-tenancy
description: Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration. Activate automatically for shared applications serving distinct organizations or customer partitions when that concern is relevant to a software-engineering request.
---

# forge-tenancy: Multi-tenancy

## Purpose

Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

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

Available deterministic support, where present:

- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-cache-usage` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

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

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- OWASP Multi Tenant Security Cheat Sheet
- OWASP Authorization Cheat Sheet

## Common production failures

- Identify the trusted tenant-context source and follow it through every boundary
- Test missing, forged, stale, and cross-tenant identifiers in reads, writes, bulk actions, exports, jobs, and websockets
- Inspect composite uniqueness, row policies, cache namespaces, object prefixes, logs, and support tooling

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add tenant-scoped tests and explicit cache-key namespaces
- Reject missing tenant context at an existing boundary

## Approval-required changes

- Changing tenant identifiers, isolation strategy, or support access

## Verification

- Run cross-tenant negative tests for every critical resource
- Confirm asynchronous work restores trusted tenant context

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Infrastructure-level isolation requires live configuration evidence
