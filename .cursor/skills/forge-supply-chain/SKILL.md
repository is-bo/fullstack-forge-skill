---
name: forge-supply-chain
description: Inspect dependencies, build integrity, provenance, releases, licenses, actions, and secret exposure across the delivery chain. Activate automatically for any project consuming or publishing software artifacts when that concern is relevant to a software-engineering request.
---

# forge-supply-chain: Software supply chain

## Purpose

Inspect dependencies, build integrity, provenance, releases, licenses, actions, and secret exposure across the delivery chain.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves software supply chain, when
the user explicitly names `forge-supply-chain`, or when discovery proves an applicable boundary.

- Any project consuming or publishing software artifacts

## When not to activate

- No exemption for executable release artifacts

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- lockfiles
- build and release workflows
- artifact and license inventory

Available deterministic support, where present:

- Use `inspect-dependencies` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-ci` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Audit dependencies with the lockfile: known vulnerabilities, abandoned packages, and unexpected install scripts.
3. Verify lockfile consistency, pinning strategy, and provenance for critical packages, including typosquat review for recent additions.
4. Inspect CI workflows for action pinning, least-privilege tokens, fork safety, and secret exposure in logs.
5. Trace release-artifact integrity: reproducibility, checksums, and signing or provenance attestation.
6. Check container base images, the update strategy, and license compatibility across the dependency tree.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Triage vulnerabilities for actual reachability and compensating controls
- Review maintainer and registry trust for critical dependencies

Stack-specific guidance:

- Disable or isolate install scripts where compatible and use least-privilege CI tokens

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- SLSA 1.2
- NIST SSDF
- OpenSSF Scorecard concepts

## Common production failures

- Verify lockfile integrity, direct and transitive dependency review, vulnerability output, lifecycle scripts, and abandoned packages
- Inspect CI action pinning, token permissions, untrusted build inputs, artifact signing, provenance, checksums, reproducibility, and protected release flow
- Validate declared licenses, notices, source attribution, generated-file provenance, and secret scanning

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Vulnerable dependencies
- Abandoned packages
- Unexpected install scripts
- Lockfile consistency
- Dependency pinning
- Package provenance
- Build reproducibility
- CI action pinning
- Generated artifacts
- Secrets in build logs
- SBOM generation
- License compatibility
- Typosquatting
- Container base images
- Update strategy
- Compromised transitive dependencies
- Release provenance
- SLSA concepts where appropriate

## Commands and tools

- Run `forge supply-chain audit --json` or `fullstack-forge supply-chain audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-dependencies` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-ci` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Pin action commits and compatible dependency patches after tests
- Correct license inventory and checksums

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Major dependency upgrades, replacing registries, rotating tokens, or changing release authority

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Rebuild from a clean checkout with the lockfile
- Compare artifacts, checksums, SBOM, and provenance

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- A vulnerability identifier alone does not prove exploitability or safety

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
