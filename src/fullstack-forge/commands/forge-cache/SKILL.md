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

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Introducing Redis or changing consistency and invalidation semantics

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Exercise hit, miss, stale, invalidated, stampede, and cache-down paths
- Confirm cross-user and cross-tenant isolation

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Cache value requires workload measurements
- Cache-key resolution is bounded to local static expressions; cross-file helpers, dynamic computed properties, and non-linear reassignment remain NOT_VERIFIED

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
