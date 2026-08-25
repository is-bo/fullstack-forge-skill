---
name: forge-ship
description: "Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation."
---

# forge-ship: Release readiness

Engine: Forge native

## Purpose

Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation.



Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

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

Deterministic support, bounded evidence only:

- `validate-skill`
- `check-platform-assets`
- `package-platforms`
- `smoke-install`

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

Standards used as criteria:

- SLSA 1.2
- NIST SSDF
- Agent Skills Specification

## Common production failures

- Re-discover and inspect the stable current revision, then run applicable format, lint, type, unit, integration, end-to-end, build, security, dependency, migration, authorization, upload, and validation checks
- Check canonical/generated synchronization, deterministic packaging, checksums, attribution, and clean installation
- Fail for open critical or required high findings, failed gates, unregistered or stale evidence, incomplete packages, or required high-risk NOT_VERIFIED checks

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- No implicit fixes; invoke module fix modes separately with explicit scope
- Regenerate deterministic derived assets

## Approval-required changes

- Publishing, deploying, bypassing a gate, or accepting high residual risk

## Verification

- Repeat the complete gate after the final change
- Install release artifacts in a clean temporary project and invoke the skill

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- A local gate cannot prove remote CI, registry, release, or deployment status
