---
name: forge-authorization
description: Verify deny-by-default function, object, role, tenant, and administrative authorization on every path. Activate automatically for any private, role-gated, owned, tenant, or administrative resource when that concern is relevant to a software-engineering request.
---

# forge-authorization: Authorization

## Purpose

Verify deny-by-default function, object, role, tenant, and administrative authorization on every path.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves authorization, when
the user explicitly names `forge-authorization`, or when discovery proves an applicable boundary.

- Any private, role-gated, owned, tenant, or administrative resource

## When not to activate

- Public read-only content with no hidden data or action

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- role inventory
- private and admin routes
- policy code and tests

Available deterministic support, where present:

- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Build the access-control matrix: subjects, roles, resources, and operations, derived from code rather than documentation.
3. Trace each protected route to the final data query and locate the authorization predicate at the last boundary, not only in middleware.
4. Test object-level access: substitute another subject's identifier at every ID-taking endpoint and record the enforcement evidence.
5. Check non-HTTP paths: exports, downloads, background jobs, scheduled tasks, WebSocket subscriptions, and admin interfaces for the same predicates.
6. Verify default-deny: enumerate what an unauthenticated and a minimally privileged caller can reach, and demand negative tests for every privileged operation.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Confirm intended role semantics and ownership transitions
- Review break-glass and support impersonation controls

Stack-specific guidance:

- Never rely on UI visibility as authorization; test final data access

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Centralize an existing repeated policy check without semantic change
- Add negative authorization tests

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing roles, policy semantics, tenant isolation, or administrative access

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run the matrix with allowed and denied principals
- Verify denied attempts are safely logged without sensitive data

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Policy intent requires an authoritative owner

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
