---
name: forge-cost
description: Tie resource and vendor cost to workloads, ownership, unit economics, budgets, and safe optimization choices. Activate automatically for paid infrastructure, apis, ai, storage, messaging, or observability when that concern is relevant to a software-engineering request.
---

# forge-cost: Cost efficiency

## Purpose

Tie resource and vendor cost to workloads, ownership, unit economics, budgets, and safe optimization choices.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves cost efficiency, when
the user explicitly names `forge-cost`, or when discovery proves an applicable boundary.

- Paid infrastructure, APIs, AI, storage, messaging, or observability

## When not to activate

- No material variable or fixed operating cost

## Automated support

Relevant discovery inputs are:

- architecture profile
- usage measurements
- pricing and billing exports

Available deterministic support, where present:

- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Attribute current spend: map each paid service, plan, and resource to the workload that uses it.
2. Identify waste: always-on resources for bursty loads, oversized instances, unused capacity, and orphaned resources.
3. Trace the expensive operations: costly queries, chatty integrations, retry amplification, AI token usage, and egress-heavy paths.
4. Compute unit economics where tenancy exists: cost per tenant or user against plan pricing.
5. Project cost at the stated growth scenario and check budgets, alerts, and retention policies for logs and storage.

Manual inspection requirements:

- Review current provider pricing and contractual commitments
- Validate product value and growth assumptions

Stack-specific guidance:

- Include managed-service minimums, egress, support, and observability costs

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- FinOps Framework concepts
- provider billing documentation

## Common production failures

- Map cost centers to services, tenants, features, environments, and owners
- Inspect idle resources, retention, egress, log cardinality, build minutes, queries, storage lifecycle, and retry amplification
- Define budgets, anomaly alerts, unit metrics, and cost-performance-reliability tradeoffs

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Hosting cost
- Database-plan usage
- Storage growth
- Egress
- AI API usage
- Logging cost
- Monitoring cost
- Always-on services
- Oversized resources
- Inefficient jobs
- Cache cost versus value
- Expensive queries
- Third-party subscriptions
- Per-tenant cost
- Projected cost at scale
- Waste caused by retries
- Large-file storage
- Retention cost

## Commands and tools

- Run `forge cost audit --json` or `fullstack-forge cost audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add cost attribution tags and bounded retention
- Remove a proven unused non-production resource through an approved workflow

## Approval-required changes

- Deleting resources, changing service tier, retention, reliability, or customer-visible limits

## Verification

- Compare normalized billing before and after over a representative period
- Confirm reliability and performance budgets remain satisfied

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Pricing is time-sensitive and must be verified at audit time
