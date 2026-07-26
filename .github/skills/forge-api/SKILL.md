---
name: forge-api
description: Audit API contracts, boundary validation, authorization, consistency, pagination, errors, and idempotency. Activate automatically for http, graphql, rpc, or event-consumed application interfaces when that concern is relevant to a software-engineering request.
---

# forge-api: API design and implementation

## Purpose

Audit API contracts, boundary validation, authorization, consistency, pagination, errors, and idempotency.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves api design and implementation, when
the user explicitly names `forge-api`, or when discovery proves an applicable boundary.

- HTTP, GraphQL, RPC, or event-consumed application interfaces

## When not to activate

- Applications with no machine-consumed interface

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- route inventory
- API specifications
- handlers, middleware, and tests

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Enumerate every route from router evidence, with method, path, handler location, and authentication expectation.
3. Trace representative endpoints from input parsing to response: verify server-side validation at entry, output shape control at exit, and correct status codes for each failure class.
4. Check list endpoints for pagination, bounds, filtering, and deterministic ordering.
5. Inspect error responses for internal detail leakage and contract consistency.
6. Verify idempotency for retried mutations, rate limits on unauthenticated surfaces, request-size limits, and that the documented contract (OpenAPI or schema) matches the implementation.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review compatibility and deprecation policy
- Inspect representative requests across roles and ownership boundaries

Stack-specific guidance:

- Inspect the final router and middleware composition, not annotations alone

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- OpenAPI 3.2
- OWASP API Security Top 10 2023
- RFC 9110

## Common production failures

- Compare implemented routes, methods, schemas, status codes, errors, and versioning with the contract
- Inspect input limits, mass assignment, object authorization, rate limits, pagination, filtering, and response data exposure
- Verify idempotency and concurrency behavior for retryable or money-moving operations

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Contract consistency
- Input validation
- Output validation
- Status codes
- Error formats
- Pagination
- Filtering
- Sorting
- Versioning
- Idempotency
- Rate limits
- Timeouts
- Retry behavior
- Backward compatibility
- Over-fetching
- Under-fetching
- Sensitive field exposure
- API documentation
- OpenAPI coverage
- Webhook contracts
- GraphQL depth
- GraphQL complexity
- REST naming
- Client/server type drift
- Request-size limits
- Response-size limits
- OpenAPI generation or validation where appropriate

## Commands and tools

- Run `forge api audit --json` or `fullstack-forge api audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add schema validation, explicit limits, and consistent error envelopes
- Correct documentation that is demonstrably stale

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing a public contract, version, or authorization semantics

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run contract and negative-boundary tests
- Replay duplicates and unauthorized object identifiers

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- External consumer behavior requires compatibility evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
