---
name: forge-all
description: Discover the project, select applicable modules, run safe independent checks, merge evidence, and prioritize remediation. Activate automatically for repository-wide audits when that concern is relevant to a software-engineering request.
---

# forge-all: Orchestrated audit

Engine: Forge native

## Purpose

Discover the project, select applicable modules, run safe independent checks, merge evidence, and prioritize remediation.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves orchestrated audit, when
the user explicitly names `forge-all`, or when discovery proves an applicable boundary.

- Repository-wide audits
- Changed-scope reviews
- High-risk review before release

## When not to activate

- A narrowly requested module where orchestration adds no value

## Automated support

Relevant discovery inputs are:

- project profile
- scope and risk flags
- all applicable module outputs

Deterministic support, bounded evidence only:

- `discover-project`
- `generate-report`
- `validate-finding-schema`

## Agent inspection procedure

1. Run discovery first and derive the applicable module set from capability evidence, recording an explicit `NOT_APPLICABLE` decision for each skipped module.
2. Order execution: independent read-only modules may run in any order; run discovery-dependent modules after the profile exists.
3. Execute each applicable module's own procedure, preserving its evidence and finding identifiers unchanged.
4. Merge duplicate findings across modules by root cause, preserving every location and the strictest severity.
5. Rank the combined findings by severity, confidence, effort, and impact, and emit a prioritized remediation plan with blocked and unverified checks stated plainly.

Manual inspection requirements:

- Review applicability decisions and merged-finding fidelity
- Approve any risky fix plan before mutation

Stack-specific guidance:

- Use project-native commands discovered from manifests and CI

## Evidence to collect

Standards used as criteria:

- Fullstack Forge finding schema
- NIST SSDF

## Common production failures

- Run discovery first and determine applicability from recorded evidence
- Execute independent read-only checks concurrently only where safe and preserve raw results
- Merge duplicates without losing locations or standards and rank by severity, confidence, impact, and effort

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Run project discovery before specialist modules
- Determine applicability from current evidence
- Avoid irrelevant modules
- Run independent read-only modules concurrently only when safe
- Merge duplicate findings while preserving every location
- Preserve raw evidence and failed checks
- Rank findings by severity, confidence, impact, and effort
- Generate Markdown and JSON reports
- Produce a prioritized remediation plan
- Clearly mark blocked and not-verified checks

## Commands and tools

- Run `forge all audit --json` or `fullstack-forge all audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Apply only fixes each module labels safe when --safe is explicit
- Regenerate Markdown and JSON reports

## Approval-required changes

- Any risky module change or expansion outside the requested scope

## Verification

- Re-run affected modules and the applicable regression suite
- Mark every skipped, blocked, or unverified check explicitly

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Orchestration does not turn unavailable runtime evidence into PASS
