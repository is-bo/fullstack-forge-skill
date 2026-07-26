---
name: forge-supply-chain
description: Inspect dependencies, build integrity, provenance, releases, licenses, actions, and secret exposure across the delivery chain. Activate automatically for any project consuming or publishing software artifacts when that concern is relevant to a software-engineering request.
---

# forge-supply-chain: Software supply chain

## Purpose

Inspect dependencies, build integrity, provenance, releases, licenses, actions, and secret exposure across the delivery chain.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves software supply chain, when
the user explicitly names `forge-supply-chain`, or when discovery proves an applicable boundary.

- Any project consuming or publishing software artifacts

## When not to activate

- No exemption for executable release artifacts

## Automated support

Relevant discovery inputs are:

- lockfiles
- build and release workflows
- artifact and license inventory

Available deterministic support, where present:

- Use `inspect-dependencies` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-ci` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Audit dependencies with the lockfile: known vulnerabilities, abandoned packages, and unexpected install scripts.
2. Verify lockfile consistency, pinning strategy, and provenance for critical packages, including typosquat review for recent additions.
3. Inspect CI workflows for action pinning, least-privilege tokens, fork safety, and secret exposure in logs.
4. Trace release-artifact integrity: reproducibility, checksums, and signing or provenance attestation.
5. Check container base images, the update strategy, and license compatibility across the dependency tree.

Manual inspection requirements:

- Triage vulnerabilities for actual reachability and compensating controls
- Review maintainer and registry trust for critical dependencies

Stack-specific guidance:

- Disable or isolate install scripts where compatible and use least-privilege CI tokens

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Pin action commits and compatible dependency patches after tests
- Correct license inventory and checksums

## Approval-required changes

- Major dependency upgrades, replacing registries, rotating tokens, or changing release authority

## Verification

- Rebuild from a clean checkout with the lockfile
- Compare artifacts, checksums, SBOM, and provenance

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- A vulnerability identifier alone does not prove exploitability or safety
