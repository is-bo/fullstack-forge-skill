---
name: forge-architecture
description: Evaluate system boundaries, dependency direction, failure domains, and the fitness of the current topology. Activate automatically for multi-component applications when that concern is relevant to a software-engineering request.
---

# forge-architecture: Architecture

## Purpose

Evaluate system boundaries, dependency direction, failure domains, and the fitness of the current topology.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves architecture, when
the user explicitly names `forge-architecture`, or when discovery proves an applicable boundary.

- Multi-component applications
- Material structural changes
- Scale or reliability reviews

## When not to activate

- A single isolated script with no service or data boundary

## Automated support

Relevant discovery inputs are:

- architecture map
- dependency manifests
- runtime and deployment configuration

Available deterministic support, where present:

- Use `discover-project` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Build the dependency graph between modules or packages and record direction violations, cycles, and layering breaks with file evidence.
2. Locate domain logic and check whether it sits inside framework handlers, UI components, or migrations rather than in testable core modules.
3. Trace one write-path transaction end to end and record where transaction, error, and retry boundaries actually sit.
4. Identify shared mutable state, singletons, and hidden coupling between components that the module graph does not show.
5. Assess the topology against actual scale evidence: flag both missing boundaries under real load and speculative microservices, queues, or abstraction layers with no driver.

Manual inspection requirements:

- Validate context boundaries and ownership with maintainers
- Review unavailable runtime dependencies and organization constraints

Stack-specific guidance:

- Respect framework composition boundaries before introducing custom layers

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- C4 model concepts
- NIST SSDF

## Common production failures

- Trace one critical request end to end across UI, API, jobs, data, and integrations
- Detect cycles, boundary leakage, shared mutable state, and single points of failure
- Compare complexity and operational cost with demonstrated requirements

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Module boundaries
- Dependency direction
- Circular dependencies
- Framework coupling
- Domain logic placement
- Service boundaries
- Transaction boundaries
- Error boundaries
- Duplicate abstractions
- Excessive abstraction
- God modules
- Single points of failure
- Hidden shared state
- Scalability risks
- Premature microservices
- Inappropriate synchronous coupling
- Configuration architecture
- Maintainability
- Underengineering and overengineering

## Commands and tools

- Run `forge architecture audit --json` or `fullstack-forge architecture audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add or update an architecture decision record
- Clarify module ownership and dependency rules

## Approval-required changes

- Splitting services, changing data ownership, or replacing core infrastructure

## Verification

- Re-run dependency and boundary checks
- Exercise the traced critical flow after structural changes

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Production traffic shape and organizational coupling require external evidence
