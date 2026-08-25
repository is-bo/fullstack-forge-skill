---
name: forge-infrastructure
description: "Audit infrastructure as code, network and identity boundaries, encryption, state, drift, and least privilege."
---

# forge-infrastructure: Infrastructure

Engine: Hybrid — Forge + Google, Cloudflare

## Purpose

Audit infrastructure as code, network and identity boundaries, encryption, state, drift, and least privilege.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" infrastructure compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Activate when a request or direct repository evidence involves infrastructure, when
the user explicitly names `forge-infrastructure`, or when discovery proves an applicable boundary.

- Cloud, container, orchestration, network, or infrastructure-as-code configuration

## When not to activate

- No managed runtime or infrastructure under project control

## Automated support

Relevant discovery inputs are:

- infrastructure code
- deployment profile
- policy and plan outputs

Deterministic support, bounded evidence only:

- `inspect-deployment-config`

## Agent inspection procedure

1. Inventory infrastructure-as-code coverage and record resources managed outside it (console drift).
2. Map network exposure: what listens publicly, TLS posture, DNS, and firewall rules; verify databases and admin services are not publicly reachable.
3. Inspect identity boundaries: IAM roles, service accounts, and storage permissions against least privilege.
4. Verify secret management: storage, injection, rotation capability, and absence from code and state files.
5. Check resource limits, autoscaling bounds, persistent-volume policies, and production/debug configuration differences.

Manual inspection requirements:

- Review live drift, organization policies, and break-glass access
- Inspect plan output for replacements and data risk

Stack-specific guidance:

- Respect provider and IaC tool state, lifecycle, and import semantics

## Evidence to collect

Standards used as criteria:

- CIS Benchmarks
- NIST SP 800-53 concepts
- SLSA 1.2

## Common production failures

- Inspect identity, role trust, network exposure, ingress/egress, encryption, keys, secret injection, and metadata access
- Review state protection, locking, module versions, destructive changes, drift, tags, quotas, backups, and multi-environment isolation
- Run format, validate, lint, policy, and non-mutating plan tools where available

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Infrastructure as code
- Environment parity
- Network exposure
- TLS
- DNS
- Firewalls
- Database exposure
- Storage permissions
- Secret management
- Resource limits
- Autoscaling
- Persistent volumes
- Regional placement
- Logging retention
- Production and debug differences
- Unused resources
- Public admin services
- Container configuration

## Commands and tools

- Run `forge infrastructure audit --json` or `fullstack-forge infrastructure audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Pin compatible modules and correct validated non-destructive policy omissions
- Add least-privilege documentation and static checks

## Approval-required changes

- Applying infrastructure, replacing resources, widening access, or changing production networking

## Verification

- Run validate and policy checks after final edits
- Apply only in an authorized isolated environment and inspect resulting controls

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Static IaC cannot establish live drift or inherited organization policy
