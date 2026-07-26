---
name: forge-ship
description: Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation. Activate automatically for a candidate release or deployment when that concern is relevant to a software-engineering request.
---

# forge-ship: Release readiness

## Purpose

Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves release readiness, when
the user explicitly names `forge-ship`, or when discovery proves an applicable boundary.

- A candidate release or deployment

## When not to activate

- Exploratory work not represented as release-ready

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- project profile
- prior finding reports as historical diagnostics
- detected project commands
- package and license manifests

Available deterministic support, where present:

- Use `validate-skill` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `check-platform-assets` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `package-platforms` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `smoke-install` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Re-discover and re-inspect a stable current working-tree revision, keeping prior report outcomes as diagnostics only; assemble fresh inspector evidence, authorized command results, skill validation, platform synchronization, packaging, and license checks from registered root/revision/artifact-bound producers, not memory.
3. Fail the gate on any open CRITICAL finding, any required failing check, or any required high-risk check still `NOT_VERIFIED`; never downgrade a status to proceed.
4. Verify packaging integrity: archives build deterministically, contain no symlinks or excluded content, and match their checksums.
5. Run the installation smoke test from the packed artifact in a clean directory.
6. Emit the release decision with the complete evidence ledger: what ran, what did not, why, and the residual risk accepted by shipping.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review residual risk, skipped checks, release notes, rollback, and human-only publication steps
- Confirm production authority before any deployment

Stack-specific guidance:

- Use the repository's authoritative CI commands and pinned runtime

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

- SLSA 1.2
- NIST SSDF
- Agent Skills Specification

## Common production failures

- Re-discover and inspect the stable current revision, then run applicable format, lint, type, unit, integration, end-to-end, build, security, dependency, migration, authorization, upload, and validation checks
- Check canonical/generated synchronization, deterministic packaging, checksums, attribution, and clean installation
- Fail for open critical or required high findings, failed gates, unregistered or stale evidence, incomplete packages, or required high-risk NOT_VERIFIED checks

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Current format, lint, typecheck, unit, integration, end-to-end, and production build gates with registered root/revision/input-bound evidence
- Skill validation and platform asset synchronization
- Current security, dependency, migration, authorization, and upload-security checks re-derived independently of prior report outcomes
- Package, archive, license, attribution, and installation smoke validation
- Open critical findings block release
- Required open high-severity findings block release
- Failed required tests or build block release
- Invalid skills or out-of-sync generated copies block release
- Required high-risk NOT_VERIFIED checks block release
- Incomplete packaging or failed installation smoke tests block release
- Invalid license or attribution evidence blocks release
- Remote CI, release, and production state require separate direct verification

## Commands and tools

- Run `forge ship audit --json` or `fullstack-forge ship audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `validate-skill` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `check-platform-assets` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `package-platforms` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `smoke-install` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- No implicit fixes; invoke module fix modes separately with explicit scope
- Regenerate deterministic derived assets

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Publishing, deploying, bypassing a gate, or accepting high residual risk

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Repeat the complete gate after the final change
- Install release artifacts in a clean temporary project and invoke the skill

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

- A local gate cannot prove remote CI, registry, release, or deployment status

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
