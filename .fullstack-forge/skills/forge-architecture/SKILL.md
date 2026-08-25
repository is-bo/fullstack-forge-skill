---
name: forge-architecture
description: "Evaluate system boundaries, dependency direction, failure domains, and the fitness of the current topology."
---

# forge-architecture: Architecture

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Google

## Purpose

Evaluate system boundaries, dependency direction, failure domains, and the fitness of the current topology.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" architecture compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Deterministic support, bounded evidence only:

- `discover-project`

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

Standards used as criteria:

- C4 model concepts
- NIST SSDF

## Common production failures

- Trace one critical request end to end across UI, API, jobs, data, and integrations
- Detect cycles, boundary leakage, shared mutable state, and single points of failure
- Compare complexity and operational cost with demonstrated requirements

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add or update an architecture decision record
- Clarify module ownership and dependency rules

## Approval-required changes

- Splitting services, changing data ownership, or replacing core infrastructure

## Verification

- Re-run dependency and boundary checks
- Exercise the traced critical flow after structural changes

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Production traffic shape and organizational coupling require external evidence
