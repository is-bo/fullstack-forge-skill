---
name: forge-cache
description: First decide whether caching is justified, then audit keys, invalidation, consistency, privacy, and failure behavior. Activate automatically for detected caches, cdns, memoization, or a measured proposal to add caching when that concern is relevant to a software-engineering request.
---

# forge-cache: Caching

## Purpose

First decide whether caching is justified, then audit keys, invalidation, consistency, privacy, and failure behavior.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves caching, when
the user explicitly names `forge-cache`, or when discovery proves an applicable boundary.

- Detected caches, CDNs, memoization, or a measured proposal to add caching

## When not to activate

- No cache and no measured latency or load need

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- cache clients and configuration
- query and request flows
- performance evidence

Available deterministic support, where present:

- Use `inspect-cache-usage` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. First establish necessity: find the measured bottleneck a cache addresses; if none exists, conclude that no cache — including Redis — is justified.
3. Inventory cache layers (browser, CDN, application, framework) and every key-construction site.
4. Verify keys include every dimension that changes the value: user, tenant, locale, and version; test two-user and two-tenant collisions.
5. Trace invalidation for each write path that changes cached data, and check TTL, stampede protection, and negative caching.
6. Inspect failure behavior (cache down must degrade correctly), sensitive-data exposure in shared caches, and memory or eviction limits.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review consistency tolerance with product owners
- Validate managed cache eviction and network policy

Stack-specific guidance:

- Account for framework, CDN, browser, server, and data caches as separate layers

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

- Redis eviction documentation
- RFC 9111

## Common production failures

- Require a measured bottleneck and explicit freshness contract before recommending a cache
- Inspect key completeness, tenant and user scope, TTL, invalidation, stampede control, negative caching, serialization, and versioning
- Check sensitive-data exposure, authorization changes, eviction, memory limits, outage fallback, and observability

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Evidence that caching is justified
- Cache layers
- Browser caching
- CDN caching
- Server caching
- Framework caching
- Redis usage
- Cache keys
- Tenant isolation
- User isolation
- TTL
- Invalidation
- Stampede protection
- Stale-data tolerance
- Negative caching
- Cache size
- Serialization
- Failure fallback
- Sensitive data
- Cache poisoning
- Cross-user leakage
- Cross-tenant leakage
- Cache observability
- An explicit conclusion that Redis is unnecessary when evidence supports it

## Commands and tools

- Run `forge cache audit --json` or `fullstack-forge cache audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-cache-usage` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Namespace incomplete keys and add bounded TTLs where semantics are established
- Add cache hit/miss and fallback telemetry without sensitive values

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Introducing Redis or changing consistency and invalidation semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Exercise hit, miss, stale, invalidated, stampede, and cache-down paths
- Confirm cross-user and cross-tenant isolation

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

- Cache value requires workload measurements

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
