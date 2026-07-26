---
name: forge-all
description: Discover the project, select applicable modules, run safe independent checks, merge evidence, and prioritize remediation. Activate automatically for repository-wide audits when that concern is relevant to a software-engineering request.
---

# forge-all: Orchestrated audit

## Purpose

Discover the project, select applicable modules, run safe independent checks, merge evidence, and prioritize remediation.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves orchestrated audit, when
the user explicitly names `forge-all`, or when discovery proves an applicable boundary.

- Repository-wide audits
- Changed-scope reviews
- High-risk review before release

## When not to activate

- A narrowly requested module where orchestration adds no value

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- project profile
- scope and risk flags
- all applicable module outputs

Available deterministic support, where present:

- Use `discover-project` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `generate-report` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `validate-finding-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Run discovery first and derive the applicable module set from capability evidence, recording an explicit `NOT_APPLICABLE` decision for each skipped module.
3. Order execution: independent read-only modules may run in any order; run discovery-dependent modules after the profile exists.
4. Execute each applicable module's own procedure, preserving its evidence and finding identifiers unchanged.
5. Merge duplicate findings across modules by root cause, preserving every location and the strictest severity.
6. Rank the combined findings by severity, confidence, effort, and impact, and emit a prioritized remediation plan with blocked and unverified checks stated plainly.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review applicability decisions and merged-finding fidelity
- Approve any risky fix plan before mutation

Stack-specific guidance:

- Use project-native commands discovered from manifests and CI

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- Fullstack Forge finding schema
- NIST SSDF

## Common production failures

- Run discovery first and determine applicability from recorded evidence
- Execute independent read-only checks concurrently only where safe and preserve raw results
- Merge duplicates without losing locations or standards and rank by severity, confidence, impact, and effort

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use `discover-project` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `generate-report` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `validate-finding-schema` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Apply only fixes each module labels safe when --safe is explicit
- Regenerate Markdown and JSON reports

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Any risky module change or expansion outside the requested scope

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Re-run affected modules and the applicable regression suite
- Mark every skipped, blocked, or unverified check explicitly

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Orchestration does not turn unavailable runtime evidence into PASS

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
