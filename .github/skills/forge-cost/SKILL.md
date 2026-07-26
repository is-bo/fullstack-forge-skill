---
name: forge-cost
description: Tie resource and vendor cost to workloads, ownership, unit economics, budgets, and safe optimization choices. Activate automatically for paid infrastructure, apis, ai, storage, messaging, or observability when that concern is relevant to a software-engineering request.
---

# forge-cost: Cost efficiency

## Purpose

Tie resource and vendor cost to workloads, ownership, unit economics, budgets, and safe optimization choices.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves cost efficiency, when
the user explicitly names `forge-cost`, or when discovery proves an applicable boundary.

- Paid infrastructure, APIs, AI, storage, messaging, or observability

## When not to activate

- No material variable or fixed operating cost

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- architecture profile
- usage measurements
- pricing and billing exports

Available deterministic support, where present:

- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Attribute current spend: map each paid service, plan, and resource to the workload that uses it.
3. Identify waste: always-on resources for bursty loads, oversized instances, unused capacity, and orphaned resources.
4. Trace the expensive operations: costly queries, chatty integrations, retry amplification, AI token usage, and egress-heavy paths.
5. Compute unit economics where tenancy exists: cost per tenant or user against plan pricing.
6. Project cost at the stated growth scenario and check budgets, alerts, and retention policies for logs and storage.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review current provider pricing and contractual commitments
- Validate product value and growth assumptions

Stack-specific guidance:

- Include managed-service minimums, egress, support, and observability costs

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
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add cost attribution tags and bounded retention
- Remove a proven unused non-production resource through an approved workflow

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Deleting resources, changing service tier, retention, reliability, or customer-visible limits

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Compare normalized billing before and after over a representative period
- Confirm reliability and performance budgets remain satisfied

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

- Pricing is time-sensitive and must be verified at audit time

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
