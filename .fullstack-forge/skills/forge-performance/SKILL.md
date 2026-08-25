---
name: forge-performance
description: "Measure and improve user- and system-visible latency, throughput, resource use, and stability without guessing."
---

# forge-performance: Performance

Engine: Upstream-powered — Addy Osmani Agent Skills

## Purpose

Measure and improve user- and system-visible latency, throughput, resource use, and stability without guessing.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" performance compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Deterministic support, bounded evidence only:

- `detect-project-commands`
- `run-project-command`

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

Standards used as criteria:

- Core Web Vitals
- OpenTelemetry semantic conventions

## Common production failures

- Define representative workloads, devices, networks, data sizes, and percentile budgets
- Measure frontend Core Web Vitals, bundle cost, server latency, database time, memory, CPU, I/O, and external calls as applicable
- Identify the dominant bottleneck before changing code and check cold starts, concurrency, leaks, and backpressure

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Remove proven duplicate work and add bounded pagination
- Declare dimensions and lazy-load noncritical assets after measurement

## Approval-required changes

- Adding infrastructure, caches, denormalization, or behavior-changing approximations

## Verification

- Repeat the same benchmark with uncertainty and environment recorded
- Confirm correctness and tail latency did not regress

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Do not invent performance measurements or extrapolate from unrelated hardware
