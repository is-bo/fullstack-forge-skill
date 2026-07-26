---
name: forge-scale
description: Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios. Activate automatically for expected growth, load concentration, or capacity incidents when that concern is relevant to a software-engineering request.
---

# forge-scale: Scalability

## Purpose

Assess growth limits, contention, partitioning, quotas, backpressure, and cost against explicit demand scenarios.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

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

Available deterministic support, where present:

- Use `detect-project-commands` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `run-project-command` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

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

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add explicit bounds, batching, backpressure, and capacity telemetry
- Document measured limits

## Approval-required changes

- Introducing services, sharding, queues, caches, or multi-region topology

## Verification

- Run staged load tests through saturation and recovery
- Confirm correctness and tenant fairness under contention

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Capacity projections are only as credible as workload evidence
