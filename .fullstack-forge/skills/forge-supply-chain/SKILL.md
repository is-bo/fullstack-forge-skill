---
name: forge-supply-chain
description: "Inspect dependencies, build integrity, provenance, releases, licenses, actions, and secret exposure across the delivery chain."
---

# forge-supply-chain: Software supply chain

Engine: Hybrid — Forge + Addy Osmani Agent Skills

## Purpose

Inspect dependencies, build integrity, provenance, releases, licenses, actions, and secret exposure across the delivery chain.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" supply-chain compose --workflow audit --root "<repository-root>" --dry-run --json`

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

Deterministic support, bounded evidence only:

- `inspect-dependencies`
- `inspect-ci`
- `scan-secret-patterns`

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

Standards used as criteria:

- SLSA 1.2
- NIST SSDF
- OpenSSF Scorecard concepts

## Common production failures

- Verify lockfile integrity, direct and transitive dependency review, vulnerability output, lifecycle scripts, and abandoned packages
- Inspect CI action pinning, token permissions, untrusted build inputs, artifact signing, provenance, checksums, reproducibility, and protected release flow
- Validate declared licenses, notices, source attribution, generated-file provenance, and secret scanning

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Pin action commits and compatible dependency patches after tests
- Correct license inventory and checksums

## Approval-required changes

- Major dependency upgrades, replacing registries, rotating tokens, or changing release authority

## Verification

- Rebuild from a clean checkout with the lockfile
- Compare artifacts, checksums, SBOM, and provenance

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- A vulnerability identifier alone does not prove exploitability or safety
