---
name: forge-authorization
description: Verify deny-by-default function, object, role, tenant, and administrative authorization on every path. Activate automatically for any private, role-gated, owned, tenant, or administrative resource when that concern is relevant to a software-engineering request.
---

# forge-authorization: Authorization

## Purpose

Verify deny-by-default function, object, role, tenant, and administrative authorization on every path.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves authorization, when
the user explicitly names `forge-authorization`, or when discovery proves an applicable boundary.

- Any private, role-gated, owned, tenant, or administrative resource

## When not to activate

- Public read-only content with no hidden data or action

## Automated support

Relevant discovery inputs are:

- role inventory
- private and admin routes
- policy code and tests

Available deterministic support, where present:

- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Build the access-control matrix: subjects, roles, resources, and operations, derived from code rather than documentation.
2. Trace each protected route to the final data query and locate the authorization predicate at the last boundary, not only in middleware.
3. Test object-level access: substitute another subject's identifier at every ID-taking endpoint and record the enforcement evidence.
4. Check non-HTTP paths: exports, downloads, background jobs, scheduled tasks, WebSocket subscriptions, and admin interfaces for the same predicates.
5. Verify default-deny: enumerate what an unauthenticated and a minimally privileged caller can reach, and demand negative tests for every privileged operation.

Manual inspection requirements:

- Confirm intended role semantics and ownership transitions
- Review break-glass and support impersonation controls

Stack-specific guidance:

- Never rely on UI visibility as authorization; test final data access

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- OWASP ASVS 5.0
- OWASP Authorization Cheat Sheet
- OWASP API1 and API5

## Common production failures

- Build a subject-action-resource-context matrix for critical resources
- Trace enforcement at server boundaries, jobs, exports, uploads, websockets, and indirect identifiers
- Test horizontal, vertical, tenant, stale-role, bulk, and confused-deputy cases

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Role definitions
- Permission definitions
- Default-deny behavior
- Server-side enforcement
- Resource ownership
- Object-level authorization
- Field-level authorization
- Tenant isolation
- Admin boundaries
- Staff impersonation
- Privilege escalation
- Direct object references
- Exports
- File downloads
- Background jobs
- Scheduled jobs
- WebSocket subscriptions
- API keys
- Service accounts
- Access-control matrix
- Negative tests for unauthorized reads and writes

## Commands and tools

- Run `forge authorization audit --json` or `fullstack-forge authorization audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Centralize an existing repeated policy check without semantic change
- Add negative authorization tests

## Approval-required changes

- Changing roles, policy semantics, tenant isolation, or administrative access

## Verification

- Run the matrix with allowed and denied principals
- Verify denied attempts are safely logged without sensitive data

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Policy intent requires an authoritative owner
