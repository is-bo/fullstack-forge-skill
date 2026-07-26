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

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

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

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Applying infrastructure, replacing resources, widening access, or changing production networking

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run validate and policy checks after final edits
- Apply only in an authorized isolated environment and inspect resulting controls

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

- Static IaC cannot establish live drift or inherited organization policy

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
