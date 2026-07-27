---
name: forge-infrastructure
description: Audit infrastructure as code, network and identity boundaries, encryption, state, drift, and least privilege. Activate automatically for cloud, container, orchestration, network, or infrastructure-as-code configuration when that concern is relevant to a software-engineering request.
---

# forge-infrastructure: Infrastructure

## Purpose

Audit infrastructure as code, network and identity boundaries, encryption, state, drift, and least privilege.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

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

Available deterministic support, where present:

- Use `inspect-deployment-config` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

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

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Pin compatible modules and correct validated non-destructive policy omissions
- Add least-privilege documentation and static checks

## Approval-required changes

- Applying infrastructure, replacing resources, widening access, or changing production networking

## Verification

- Run validate and policy checks after final edits
- Apply only in an authorized isolated environment and inspect resulting controls

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Static IaC cannot establish live drift or inherited organization policy
