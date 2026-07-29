---
name: forge-cache
description: First decide whether caching is justified, then audit keys, invalidation, consistency, privacy, and failure behavior. Activate automatically for detected caches, cdns, memoization, or a measured proposal to add caching when that concern is relevant to a software-engineering request.
---

# forge-cache: Caching

Engine: Hybrid — Forge + Vercel, Cloudflare

## Purpose

First decide whether caching is justified, then audit keys, invalidation, consistency, privacy, and failure behavior.


## Deterministic runtime composition

Before loading any provider procedure, run:

`node .fullstack-forge/runtime/cli/src/composition-entry.js cache compose --root <repository-root> --json`

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

Activate when a request or direct repository evidence involves caching, when
the user explicitly names `forge-cache`, or when discovery proves an applicable boundary.

- Detected caches, CDNs, memoization, or a measured proposal to add caching

## When not to activate

- No cache and no measured latency or load need

## Automated support

Relevant discovery inputs are:

- cache clients and configuration
- query and request flows
- performance evidence

Deterministic support, bounded evidence only:

- `inspect-cache-usage`

## Agent inspection procedure

1. First establish necessity: find the measured bottleneck a cache addresses; if none exists, conclude that no cache — including Redis — is justified.
2. Inventory cache layers (browser, CDN, application, framework) and every key-construction site.
3. Verify keys include every dimension that changes the value: user, tenant, locale, and version; test two-user and two-tenant collisions.
4. Trace invalidation for each write path that changes cached data, and check TTL, stampede protection, and negative caching.
5. Inspect failure behavior (cache down must degrade correctly), sensitive-data exposure in shared caches, and memory or eviction limits.

Manual inspection requirements:

- Review consistency tolerance with product owners
- Validate managed cache eviction and network policy

Stack-specific guidance:

- Account for framework, CDN, browser, server, and data caches as separate layers

## Evidence to collect

Standards used as criteria:

- Redis eviction documentation
- RFC 9111

## Common production failures

- Require a measured bottleneck and explicit freshness contract before recommending a cache
- Inspect key completeness, tenant and user scope, TTL, invalidation, stampede control, negative caching, serialization, and versioning
- Check sensitive-data exposure, authorization changes, eviction, memory limits, outage fallback, and observability

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Namespace incomplete keys and add bounded TTLs where semantics are established
- Add cache hit/miss and fallback telemetry without sensitive values

## Approval-required changes

- Introducing Redis or changing consistency and invalidation semantics

## Verification

- Exercise hit, miss, stale, invalidated, stampede, and cache-down paths
- Confirm cross-user and cross-tenant isolation

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Cache value requires workload measurements
- Cache-key resolution is bounded to local static expressions; cross-file helpers, dynamic computed properties, and non-linear reassignment remain NOT_VERIFIED
