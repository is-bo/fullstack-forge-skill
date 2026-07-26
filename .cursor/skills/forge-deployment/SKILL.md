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

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Deploying, rolling back production, changing secrets, or altering production topology

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Deploy to an isolated environment and exercise critical checks
- Demonstrate rollback or forward-fix with compatible migrations

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Repository workflows do not prove production settings or permissions

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
