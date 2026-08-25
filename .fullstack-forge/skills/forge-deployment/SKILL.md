---
name: forge-deployment
description: "Inspect build promotion, configuration, migrations, rollout, rollback, health, and environment parity."
---

# forge-deployment: Deployment

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Cloudflare, Google

## Purpose

Inspect build promotion, configuration, migrations, rollout, rollback, health, and environment parity.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" deployment compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Deterministic support, bounded evidence only:

- `inspect-ci`
- `inspect-deployment-config`

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

Standards used as criteria:

- NIST SSDF
- SLSA 1.2

## Common production failures

- Trace one immutable artifact from source revision through build, test, provenance, promotion, and runtime
- Inspect environment validation, secrets, migration ordering, readiness, termination, rollout, rollback, concurrency, and smoke checks
- Check preview isolation, production approvals, branch protections, and artifact retention

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add preflight validation and post-deploy smoke checks
- Pin action versions and clarify rollout documentation

## Approval-required changes

- Deploying, rolling back production, changing secrets, or altering production topology

## Verification

- Deploy to an isolated environment and exercise critical checks
- Demonstrate rollback or forward-fix with compatible migrations

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Repository workflows do not prove production settings or permissions
