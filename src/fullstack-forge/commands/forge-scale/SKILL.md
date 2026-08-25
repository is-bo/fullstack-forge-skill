---
name: forge-scale
description: "Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios."
---

# forge-scale: Scalability

Engine: Hybrid — Forge + Google, Cloudflare

## Purpose

Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" scale compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Activate when a request or direct repository evidence involves scalability, when
the user explicitly names `forge-scale`, or when discovery proves an applicable boundary.

- Expected growth, load concentration, or capacity incidents

## When not to activate

- No scale requirement beyond measured current capacity

## Automated support

Relevant discovery inputs are:

- architecture and performance evidence
- capacity targets
- provider quotas

Deterministic support, bounded evidence only:

- `detect-project-commands`
- `run-project-command`

## Agent inspection procedure

1. State the demand scenario first: expected users, concurrency, and data growth; without one, record the assumptions explicitly.
2. Find the first bottleneck: connection limits, stateful servers, shared filesystems, hot rows or hot tenants, and single-writer constraints.
3. Verify horizontal-scaling readiness: session placement, sticky state, file locality, and job distribution.
4. Check backpressure and load shedding: determine what happens at the queue, pool, and API layer when demand exceeds capacity.
5. Project storage, log, and cost growth against the scenario, and reject infrastructure additions (microservices, Kubernetes, Redis, queues) not justified by this evidence.

Manual inspection requirements:

- Validate growth and burst assumptions with operators and product owners
- Review regional and provider quota constraints

Stack-specific guidance:

- Account for framework connection pools, runtime concurrency, and managed-service quotas

## Evidence to collect

Standards used as criteria:

- Google SRE capacity-planning concepts
- OpenTelemetry

## Common production failures

- Model request, data, tenant, connection, queue, storage, and third-party growth
- Find serial bottlenecks, hot keys, fan-out, unbounded work, connection exhaustion, and noisy neighbors
- Inspect horizontal state, partition keys, rate shaping, load shedding, autoscaling signals, and graceful degradation

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add explicit bounds, batching, backpressure, and capacity telemetry
- Document measured limits

## Approval-required changes

- Introducing services, sharding, queues, caches, or multi-region topology

## Verification

- Run staged load tests through saturation and recovery
- Confirm correctness and tenant fairness under contention

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Capacity projections are only as credible as workload evidence
