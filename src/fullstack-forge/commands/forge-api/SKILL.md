---
name: forge-api
description: "Audit API contracts, boundary validation, authorization, consistency, pagination, errors, and idempotency."
---

# forge-api: API design and implementation

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Audit API contracts, boundary validation, authorization, consistency, pagination, errors, and idempotency.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" api compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

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

Deterministic support, bounded evidence only:

- `inspect-routes`

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

Standards used as criteria:

- OpenAPI 3.2
- OWASP API Security Top 10 2023
- RFC 9110

## Common production failures

- Compare implemented routes, methods, schemas, status codes, errors, and versioning with the contract
- Inspect input limits, mass assignment, object authorization, rate limits, pagination, filtering, and response data exposure
- Verify idempotency and concurrency behavior for retryable or money-moving operations

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add schema validation, explicit limits, and consistent error envelopes
- Correct documentation that is demonstrably stale

## Approval-required changes

- Changing a public contract, version, or authorization semantics

## Verification

- Run contract and negative-boundary tests
- Replay duplicates and unauthorized object identifiers

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- External consumer behavior requires compatibility evidence
