---
name: forge-cache
description: First decide whether caching is justified, then audit keys, invalidation, consistency, privacy, and failure behavior. Use for detected caches, cdns, memoization, or a measured proposal to add caching.
---

# forge-cache: Caching

## Purpose

First decide whether caching is justified, then audit keys, invalidation, consistency, privacy, and failure behavior.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-cache`, asks about caching, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Detected caches, CDNs, memoization, or a measured proposal to add caching

## When it does not apply

- No cache and no measured latency or load need

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- cache clients and configuration
- query and request flows
- performance evidence

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

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

### Concrete checks

- Require a measured bottleneck and explicit freshness contract before recommending a cache
- Inspect key completeness, tenant and user scope, TTL, invalidation, stampede control, negative caching, serialization, and versioning
- Check sensitive-data exposure, authorization changes, eviction, memory limits, outage fallback, and observability

## Required inspection criteria

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

## Safe executable checks

- Run `forge cache audit --json` or `fullstack-forge cache audit --json` when
  the CLI is installed.
- Use `inspect-cache-usage` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review consistency tolerance with product owners
- Validate managed cache eviction and network policy

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-CACH-001`, `FF-CACH-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- Namespace incomplete keys and add bounded TTLs where semantics are established
- Add cache hit/miss and fallback telemetry without sensitive values

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Introducing Redis or changing consistency and invalidation semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Exercise hit, miss, stale, invalidated, stampede, and cache-down paths
- Confirm cross-user and cross-tenant isolation

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- Redis eviction documentation
- RFC 9111

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Account for framework, CDN, browser, server, and data caches as separate layers

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Cache value requires workload measurements

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
