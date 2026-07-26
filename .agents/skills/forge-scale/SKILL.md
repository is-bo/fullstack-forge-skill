---
name: forge-scale
description: Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios. Activate automatically for expected growth, load concentration, or capacity incidents when that concern is relevant to a software-engineering request.
---

# forge-scale: Scalability

## Purpose

Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves scalability, when
the user explicitly names `forge-scale`, or when discovery proves an applicable boundary.

- Expected growth, load concentration, or capacity incidents

## When not to activate

- No scale requirement beyond measured current capacity

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- architecture and performance evidence
- capacity targets
- provider quotas

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. State the demand scenario first: expected users, concurrency, and data growth; without one, record the assumptions explicitly.
3. Find the first bottleneck: connection limits, stateful servers, shared filesystems, hot rows or hot tenants, and single-writer constraints.
4. Verify horizontal-scaling readiness: session placement, sticky state, file locality, and job distribution.
5. Check backpressure and load shedding: determine what happens at the queue, pool, and API layer when demand exceeds capacity.
6. Project storage, log, and cost growth against the scenario, and reject infrastructure additions (microservices, Kubernetes, Redis, queues) not justified by this evidence.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Validate growth and burst assumptions with operators and product owners
- Review regional and provider quota constraints

Stack-specific guidance:

- Account for framework connection pools, runtime concurrency, and managed-service quotas

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

- Google SRE capacity-planning concepts
- OpenTelemetry

## Common production failures

- Model request, data, tenant, connection, queue, storage, and third-party growth
- Find serial bottlenecks, hot keys, fan-out, unbounded work, connection exhaustion, and noisy neighbors
- Inspect horizontal state, partition keys, rate shaping, load shedding, autoscaling signals, and graceful degradation

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Expected users
- Request concurrency
- Database connection limits
- Horizontal scaling
- Stateful application servers
- Session storage
- Shared file systems
- Queue throughput
- Rate limits
- Hot rows
- Hot tenants
- Large-customer behavior
- Bulk operations
- Backpressure
- Capacity assumptions
- Storage growth
- Log growth
- Cost at scale
- No microservices, Kubernetes, queues, or Redis without evidence

## Commands and tools

- Run `forge scale audit --json` or `fullstack-forge scale audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add explicit bounds, batching, backpressure, and capacity telemetry
- Document measured limits

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Introducing services, sharding, queues, caches, or multi-region topology

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run staged load tests through saturation and recovery
- Confirm correctness and tenant fairness under contention

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

- Capacity projections are only as credible as workload evidence

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
