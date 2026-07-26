---
name: forge-ship
description: Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation. Activate automatically for a candidate release or deployment when that concern is relevant to a software-engineering request.
---

# forge-ship: Release readiness

## Purpose

Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves release readiness, when
the user explicitly names `forge-ship`, or when discovery proves an applicable boundary.

- A candidate release or deployment

## When not to activate

- Exploratory work not represented as release-ready

## Automated support

Relevant discovery inputs are:

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

1. Re-discover and re-inspect a stable current working-tree revision, keeping prior report outcomes as diagnostics only; assemble fresh inspector evidence, authorized command results, skill validation, platform synchronization, packaging, and license checks from registered root/revision/artifact-bound producers, not memory.
2. Fail the gate on any open CRITICAL finding, any required failing check, or any required high-risk check still `NOT_VERIFIED`; never downgrade a status to proceed.
3. Verify packaging integrity: archives build deterministically, contain no symlinks or excluded content, and match their checksums.
4. Run the installation smoke test from the packed artifact in a clean directory.
5. Emit the release decision with the complete evidence ledger: what ran, what did not, why, and the residual risk accepted by shipping.

Manual inspection requirements:

- Review residual risk, skipped checks, release notes, rollback, and human-only publication steps
- Confirm production authority before any deployment

Stack-specific guidance:

- Use the repository's authoritative CI commands and pinned runtime

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- No implicit fixes; invoke module fix modes separately with explicit scope
- Regenerate deterministic derived assets

## Approval-required changes

- Publishing, deploying, bypassing a gate, or accepting high residual risk

## Verification

- Repeat the complete gate after the final change
- Install release artifacts in a clean temporary project and invoke the skill

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- A local gate cannot prove remote CI, registry, release, or deployment status
