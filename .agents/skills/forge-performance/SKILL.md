---
name: forge-performance
description: Measure and improve user- and system-visible latency, throughput, resource use, and stability without guessing. Activate automatically for performance-sensitive workflows when that concern is relevant to a software-engineering request.
---

# forge-performance: Performance

## Purpose

Measure and improve user- and system-visible latency, throughput, resource use, and stability without guessing.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves performance, when
the user explicitly names `forge-performance`, or when discovery proves an applicable boundary.

- Performance-sensitive workflows
- Known regressions
- Release budgets

## When not to activate

- No claimed or measured performance requirement

## Automated support

Relevant discovery inputs are:

- performance budgets
- build artifacts
- profiles, traces, and load results

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Establish the measured baseline first: collect Core Web Vitals (LCP, INP, CLS), API latency percentiles, and database timings from real tooling, never estimates.
2. Profile the critical user flow and identify the dominant cost: network waterfall, bundle, rendering, query, or serialization.
3. Inspect payloads: bundle composition, image and font delivery, compression, and response sizes.
4. Trace the slowest database interactions to query plans and the cache hit ratios that matter.
5. Verify mobile and slow-device behavior with throttled profiles, and record background-job throughput where it gates user-visible outcomes.

Manual inspection requirements:

- Validate workload realism and user impact
- Review production traces when authorized

Stack-specific guidance:

- Use production builds and framework profilers, never development timing as release proof

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- Core Web Vitals
- OpenTelemetry semantic conventions

## Common production failures

- Define representative workloads, devices, networks, data sizes, and percentile budgets
- Measure frontend Core Web Vitals, bundle cost, server latency, database time, memory, CPU, I/O, and external calls as applicable
- Identify the dominant bottleneck before changing code and check cold starts, concurrency, leaks, and backpressure

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- LCP
- INP
- CLS
- Bundle size
- Images
- Fonts
- Network waterfalls
- API latency
- Database latency
- Cache behavior
- Memory
- CPU
- Startup time
- Payload size
- Compression
- Streaming
- Third-party latency
- Background-job throughput
- Rendering cost
- Large lists
- Mobile performance
- Slow-device behavior

## Commands and tools

- Run `forge performance audit --json` or `fullstack-forge performance audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Remove proven duplicate work and add bounded pagination
- Declare dimensions and lazy-load noncritical assets after measurement

## Approval-required changes

- Adding infrastructure, caches, denormalization, or behavior-changing approximations

## Verification

- Repeat the same benchmark with uncertainty and environment recorded
- Confirm correctness and tail latency did not regress

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Do not invent performance measurements or extrapolate from unrelated hardware
