---
name: forge-tenancy
description: Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration. Activate automatically for shared applications serving distinct organizations or customer partitions when that concern is relevant to a software-engineering request.
---

# forge-tenancy: Multi-tenancy

## Purpose

Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves multi-tenancy, when
the user explicitly names `forge-tenancy`, or when discovery proves an applicable boundary.

- Shared applications serving distinct organizations or customer partitions

## When not to activate

- Single-tenant deployments with no shared data plane

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- tenant model
- authorization policies
- queries, cache keys, storage paths, and jobs

Available deterministic support, where present:

- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-cache-usage` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Locate the tenant identifier's origin and verify it derives from authenticated identity, never from request input.
3. Trace tenant-context propagation through every data query, verifying the tenant predicate at the final data-access boundary.
4. Check isolation beyond the database: cache keys, file paths, background jobs, logs, metrics, and search indexes.
5. Inspect unique constraints and identifiers for tenant scoping, and admin or support access for explicit cross-tenant audit trails.
6. Run or demand negative tests: the same object identifier across two tenants on every access path, including exports and downloads.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review provisioning, suspension, migration, deletion, and break-glass flows
- Validate database and provider isolation settings

Stack-specific guidance:

- Ensure ORM helpers cannot be bypassed by raw queries or background workers

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-database-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-cache-usage` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add tenant-scoped tests and explicit cache-key namespaces
- Reject missing tenant context at an existing boundary

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing tenant identifiers, isolation strategy, or support access

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run cross-tenant negative tests for every critical resource
- Confirm asynchronous work restores trusted tenant context

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Infrastructure-level isolation requires live configuration evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
