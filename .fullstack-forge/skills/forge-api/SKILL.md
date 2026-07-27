---
name: forge-api
description: Audit API contracts, boundary validation, authorization, consistency, pagination, errors, and idempotency. Activate automatically for http, graphql, rpc, or event-consumed application interfaces when that concern is relevant to a software-engineering request.
---

# forge-api: API design and implementation

## Purpose

Audit API contracts, boundary validation, authorization, consistency, pagination, errors, and idempotency.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves api design and implementation, when
the user explicitly names `forge-api`, or when discovery proves an applicable boundary.

- HTTP, GraphQL, RPC, or event-consumed application interfaces

## When not to activate

- Applications with no machine-consumed interface

## Automated support

Relevant discovery inputs are:

- route inventory
- API specifications
- handlers, middleware, and tests

Available deterministic support, where present:

- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Enumerate every route from router evidence, with method, path, handler location, and authentication expectation.
2. Trace representative endpoints from input parsing to response: verify server-side validation at entry, output shape control at exit, and correct status codes for each failure class.
3. Check list endpoints for pagination, bounds, filtering, and deterministic ordering.
4. Inspect error responses for internal detail leakage and contract consistency.
5. Verify idempotency for retried mutations, rate limits on unauthenticated surfaces, request-size limits, and that the documented contract (OpenAPI or schema) matches the implementation.

Manual inspection requirements:

- Review compatibility and deprecation policy
- Inspect representative requests across roles and ownership boundaries

Stack-specific guidance:

- Inspect the final router and middleware composition, not annotations alone

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add schema validation, explicit limits, and consistent error envelopes
- Correct documentation that is demonstrably stale

## Approval-required changes

- Changing a public contract, version, or authorization semantics

## Verification

- Run contract and negative-boundary tests
- Replay duplicates and unauthorized object identifiers

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- External consumer behavior requires compatibility evidence
