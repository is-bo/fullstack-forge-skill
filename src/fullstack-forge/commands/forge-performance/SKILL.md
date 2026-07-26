---
name: forge-performance
description: Measure and improve user- and system-visible latency, throughput, resource use, and stability without guessing. Activate automatically for performance-sensitive workflows when that concern is relevant to a software-engineering request.
---

# forge-performance: Performance

## Purpose

Measure and improve user- and system-visible latency, throughput, resource use, and stability without guessing.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves performance, when
the user explicitly names `forge-performance`, or when discovery proves an applicable boundary.

- Performance-sensitive workflows
- Known regressions
- Release budgets

## When not to activate

- No claimed or measured performance requirement

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- performance budgets
- build artifacts
- profiles, traces, and load results

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Establish the measured baseline first: collect Core Web Vitals (LCP, INP, CLS), API latency percentiles, and database timings from real tooling, never estimates.
3. Profile the critical user flow and identify the dominant cost: network waterfall, bundle, rendering, query, or serialization.
4. Inspect payloads: bundle composition, image and font delivery, compression, and response sizes.
5. Trace the slowest database interactions to query plans and the cache hit ratios that matter.
6. Verify mobile and slow-device behavior with throttled profiles, and record background-job throughput where it gates user-visible outcomes.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Validate workload realism and user impact
- Review production traces when authorized

Stack-specific guidance:

- Use production builds and framework profilers, never development timing as release proof

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
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Remove proven duplicate work and add bounded pagination
- Declare dimensions and lazy-load noncritical assets after measurement

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Adding infrastructure, caches, denormalization, or behavior-changing approximations

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Repeat the same benchmark with uncertainty and environment recorded
- Confirm correctness and tail latency did not regress

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

- Do not invent performance measurements or extrapolate from unrelated hardware

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
