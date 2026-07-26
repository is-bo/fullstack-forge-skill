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

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

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

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Major dependency upgrades, replacing registries, rotating tokens, or changing release authority

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Rebuild from a clean checkout with the lockfile
- Compare artifacts, checksums, SBOM, and provenance

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

- A vulnerability identifier alone does not prove exploitability or safety

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
