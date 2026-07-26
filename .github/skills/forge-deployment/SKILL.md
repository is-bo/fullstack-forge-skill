---
name: forge-deployment
description: Inspect build promotion, configuration, migrations, rollout, rollback, health, and environment parity. Activate automatically for deployable applications and services when that concern is relevant to a software-engineering request.
---

# forge-deployment: Deployment

## Purpose

Inspect build promotion, configuration, migrations, rollout, rollback, health, and environment parity.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves deployment, when
the user explicitly names `forge-deployment`, or when discovery proves an applicable boundary.

- Deployable applications and services

## When not to activate

- Source-only examples never deployed or distributed

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- CI workflow
- deployment configuration
- build and migration commands

Available deterministic support, where present:

- Use `inspect-ci` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Trace the path from commit to production: CI gates, build reproducibility, artifact promotion, and approval boundaries.
3. Inspect migration ordering against rolling deploys: verify old code can run against the new schema and vice versa during the window.
4. Verify rollback: the mechanism, data compatibility, and evidence that it has been exercised.
5. Check environment separation for configuration, secrets injection, and parity between staging and production.
6. Verify post-deployment verification, health gating, progressive rollout or feature flags, and release notes.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review deployed settings and last successful rollback evidence
- Confirm operator access and incident procedures

Stack-specific guidance:

- Use platform-native immutable artifacts and health semantics

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

- NIST SSDF
- SLSA 1.2

## Common production failures

- Trace one immutable artifact from source revision through build, test, provenance, promotion, and runtime
- Inspect environment validation, secrets, migration ordering, readiness, termination, rollout, rollback, concurrency, and smoke checks
- Check preview isolation, production approvals, branch protections, and artifact retention

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- CI checks
- Build reproducibility
- Environment separation
- Staging
- Preview deployments
- Database migration ordering
- Zero-downtime risks
- Rollbacks
- Feature flags
- Progressive rollout
- Secrets injection
- Health checks
- Deployment approvals
- Production configuration
- Post-deployment verification
- Version compatibility
- Safe schema transitions
- Release notes

## Commands and tools

- Run `forge deployment audit --json` or `fullstack-forge deployment audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-ci` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add preflight validation and post-deploy smoke checks
- Pin action versions and clarify rollout documentation

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Deploying, rolling back production, changing secrets, or altering production topology

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Deploy to an isolated environment and exercise critical checks
- Demonstrate rollback or forward-fix with compatible migrations

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

- Repository workflows do not prove production settings or permissions

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
