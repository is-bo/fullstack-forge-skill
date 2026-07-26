---
name: forge-infrastructure
description: Audit infrastructure as code, network and identity boundaries, encryption, state, drift, and least privilege. Activate automatically for cloud, container, orchestration, network, or infrastructure-as-code configuration when that concern is relevant to a software-engineering request.
---

# forge-infrastructure: Infrastructure

## Purpose

Audit infrastructure as code, network and identity boundaries, encryption, state, drift, and least privilege.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves infrastructure, when
the user explicitly names `forge-infrastructure`, or when discovery proves an applicable boundary.

- Cloud, container, orchestration, network, or infrastructure-as-code configuration

## When not to activate

- No managed runtime or infrastructure under project control

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- infrastructure code
- deployment profile
- policy and plan outputs

Available deterministic support, where present:

- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory infrastructure-as-code coverage and record resources managed outside it (console drift).
3. Map network exposure: what listens publicly, TLS posture, DNS, and firewall rules; verify databases and admin services are not publicly reachable.
4. Inspect identity boundaries: IAM roles, service accounts, and storage permissions against least privilege.
5. Verify secret management: storage, injection, rotation capability, and absence from code and state files.
6. Check resource limits, autoscaling bounds, persistent-volume policies, and production/debug configuration differences.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review live drift, organization policies, and break-glass access
- Inspect plan output for replacements and data risk

Stack-specific guidance:

- Respect provider and IaC tool state, lifecycle, and import semantics

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- CIS Benchmarks
- NIST SP 800-53 concepts
- SLSA 1.2

## Common production failures

- Inspect identity, role trust, network exposure, ingress/egress, encryption, keys, secret injection, and metadata access
- Review state protection, locking, module versions, destructive changes, drift, tags, quotas, backups, and multi-environment isolation
- Run format, validate, lint, policy, and non-mutating plan tools where available

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Pin compatible modules and correct validated non-destructive policy omissions
- Add least-privilege documentation and static checks

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Applying infrastructure, replacing resources, widening access, or changing production networking

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run validate and policy checks after final edits
- Apply only in an authorized isolated environment and inspect resulting controls

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Static IaC cannot establish live drift or inherited organization policy

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
