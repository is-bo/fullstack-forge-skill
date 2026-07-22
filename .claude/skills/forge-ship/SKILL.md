---
name: forge-ship
description: Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation. Use for a candidate release or deployment.
---

# forge-ship: Release readiness

## Purpose

Enforce a fail-closed release gate across project checks, findings, generated assets, packages, licenses, and installation.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-ship`, asks about release readiness, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- A candidate release or deployment

## When it does not apply

- Exploratory work not represented as release-ready

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- project profile
- prior finding reports as historical diagnostics
- detected project commands
- package and license manifests

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

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

### Concrete checks

- Re-discover and inspect the stable current revision, then run applicable format, lint, type, unit, integration, end-to-end, build, security, dependency, migration, authorization, upload, and validation checks
- Check canonical/generated synchronization, deterministic packaging, checksums, attribution, and clean installation
- Fail for open critical or required high findings, failed gates, unregistered or stale evidence, incomplete packages, or required high-risk NOT_VERIFIED checks

## Required inspection criteria

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

## Safe executable checks

- Run `forge ship audit --json` or `fullstack-forge ship audit --json` when
  the CLI is installed.
- Use `validate-skill` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `check-platform-assets` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `package-platforms` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `smoke-install` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review residual risk, skipped checks, release notes, rollback, and human-only publication steps
- Confirm production authority before any deployment

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-SHIP-001`, `FF-SHIP-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- No implicit fixes; invoke module fix modes separately with explicit scope
- Regenerate deterministic derived assets

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Publishing, deploying, bypassing a gate, or accepting high residual risk

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Repeat the complete gate after the final change
- Install release artifacts in a clean temporary project and invoke the skill

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- SLSA 1.2
- NIST SSDF
- Agent Skills Specification

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use the repository's authoritative CI commands and pinned runtime

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- A local gate cannot prove remote CI, registry, release, or deployment status

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
