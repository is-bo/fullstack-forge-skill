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

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

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

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing roles, policy semantics, tenant isolation, or administrative access

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run the matrix with allowed and denied principals
- Verify denied attempts are safely logged without sensitive data

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

- Policy intent requires an authoritative owner

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
