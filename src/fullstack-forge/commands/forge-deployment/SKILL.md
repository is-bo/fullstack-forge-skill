---
name: forge-deployment
description: Inspect build promotion, configuration, migrations, rollout, rollback, health, and environment parity. Activate automatically for deployable applications and services when that concern is relevant to a software-engineering request.
---

# forge-deployment: Deployment

## Purpose

Inspect build promotion, configuration, migrations, rollout, rollback, health, and environment parity.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves deployment, when
the user explicitly names `forge-deployment`, or when discovery proves an applicable boundary.

- Deployable applications and services

## When not to activate

- Source-only examples never deployed or distributed

## Automated support

Relevant discovery inputs are:

- CI workflow
- deployment configuration
- build and migration commands

Available deterministic support, where present:

- Use `inspect-ci` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Trace the path from commit to production: CI gates, build reproducibility, artifact promotion, and approval boundaries.
2. Inspect migration ordering against rolling deploys: verify old code can run against the new schema and vice versa during the window.
3. Verify rollback: the mechanism, data compatibility, and evidence that it has been exercised.
4. Check environment separation for configuration, secrets injection, and parity between staging and production.
5. Verify post-deployment verification, health gating, progressive rollout or feature flags, and release notes.

Manual inspection requirements:

- Review deployed settings and last successful rollback evidence
- Confirm operator access and incident procedures

Stack-specific guidance:

- Use platform-native immutable artifacts and health semantics

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add preflight validation and post-deploy smoke checks
- Pin action versions and clarify rollout documentation

## Approval-required changes

- Deploying, rolling back production, changing secrets, or altering production topology

## Verification

- Deploy to an isolated environment and exercise critical checks
- Demonstrate rollback or forward-fix with compatible migrations

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Repository workflows do not prove production settings or permissions
