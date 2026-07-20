# Fullstack Forge v0.1.9 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-20. This document was not present in the v0.1.9 tag and does
not replace the checksummed, attested evidence asset attached before immutable publication. It
records the independent post-publication checks performed against the published artifacts.

Every result below was observed directly by the integrator who authored this file, against assets
downloaded from the published release into an empty directory.

This release completes the audit orchestration and report-output milestone only. The other deferred
specification areas listed in `docs/AUDIT_CLASSIFICATION_v0.1.9.md` remain open and are not covered
here.

## Identity and remote state

| Item                      | Verified value                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Feature pull request      | [#21](https://github.com/thethunderbolt/fullstack-forge-skill/pull/21)                                |
| Release-prep pull request | [#27](https://github.com/thethunderbolt/fullstack-forge-skill/pull/27)                                |
| Feature merge commit      | `bff962a` (merge of PR #21)                                                                           |
| Merge commit on `main`    | `eed7c0290bcf243124853bf3ca4d8cd273de27c6`                                                            |
| Annotated tag object      | `cb3b1f05e2c3c616c9ce56c1523a19ec044198fc`                                                            |
| Tag                       | `v0.1.9`, peels to `eed7c0290bcf243124853bf3ca4d8cd273de27c6`                                         |
| Release                   | [Fullstack Forge v0.1.9](https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.9) |
| Immutable release         | `true`; draft `false`; prerelease `false`                                                             |
| Published at              | 2026-07-20T03:47:48Z                                                                                  |
| Release workflow run      | `29715358630` — conclusion `success`                                                                  |
| Published assets          | 13 (9 platform archives, `SHA256SUMS.txt`, `manifest.json`, final evidence and its `.sha256`)         |

All ten tags `v0.1.0`–`v0.1.9` were re-resolved after publication. The nine historical tag objects
and the commits they peel to are unchanged, including `v0.1.7` (`2a2e439` → `bb35a11`) and `v0.1.8`
(`78064d3` → `87edc43`). Zero mismatches.

## Continuous integration

| Check                                              | Result                   |
| -------------------------------------------------- | ------------------------ |
| CI — `Verify (ubuntu-latest)` @ `eed7c02`          | PASS                     |
| CI — `Verify (windows-latest)` @ `eed7c02`         | PASS                     |
| CI — `Verify (macos-latest)` @ `eed7c02`           | PASS                     |
| CodeQL `Analyze JavaScript/TypeScript` @ `eed7c02` | PASS                     |
| `release` workflow @ `v0.1.9`                      | PASS (run `29715358630`) |
| Dependency review @ `eed7c02`                      | SKIPPED — PR-only action |
| Dependency review @ PR #27 head `149fa18`          | PASS                     |
| CI (all three platforms) + CodeQL @ PR #27 head    | PASS                     |
| CI (all three platforms) + CodeQL @ PR #21 head    | PASS                     |
| CI + CodeQL @ feature merge `bff962a`              | PASS                     |
| Open Dependabot alerts                             | 0                        |
| Open secret-scanning alerts                        | 0                        |
| Open code-scanning alerts                          | 0                        |

As at v0.1.7 and v0.1.8, `dependency-review` reports `skipped` on the `main` commit because the
action only evaluates pull-request diffs and structurally cannot pass on a push. Its authoritative
result for this release is the `success` on the pull-request head. The `skipped` status is not
recorded as a pass.

## Artifact integrity

| Check                                            | Result                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| `sha256sum -c SHA256SUMS.txt`                    | PASS — 9/9 OK                                          |
| Final evidence asset vs. its `.sha256`           | PASS — `7a14fd27…21c3cb`                               |
| `gh attestation verify`                          | PASS — resolves to `release.yml@refs/tags/v0.1.9`      |
| Attestation predicate                            | `https://slsa.dev/provenance/v1`                       |
| Published checksums vs. local reproducible build | PASS — 9/9 byte-identical                              |
| Extraction of all nine archives                  | PASS — 370 files in `all`, 85 in each platform archive |
| Total entries across published archives          | 1050                                                   |
| Symlink entries in ZIP central directories       | 0 across all nine archives                             |
| NTFS reparse points in extracted trees           | 0                                                      |
| Private specification material in archives       | ABSENT — see below                                     |

Deterministic rebuild: the nine archives produced locally on Windows from the released tree were
compared byte-for-byte against the nine downloaded from the release. All nine were identical, so the
release archives reproduce exactly on a different operating system from the Linux runner that built
them.

## Private specification material

`FULLSTACK_FORGE_SPEC.md` is untracked, appears in no `git ls-files` output, is present in no
published archive, and is present in no packed tarball. `npm pack --dry-run --json` on the released
tree lists 586 files, none of which is specification material; the only filename matches for the
substring `spec` are `build/cli/src/inspectors.*`, the compiled inspector modules.

All nine archives were extracted to disk and scanned: 1050 files, 38,024,119 bytes. The string
`FULLSTACK_FORGE_SPEC` occurs nine times, once per archive, and every occurrence is in
`docs/RELEASE_VERIFICATION_v0.1.9.md` in the sentence stating that the specification file is
untracked. That is a filename reference in the project's own evidence document, not specification
content. No specification content, structure, or unreleased material appears in any published asset.

## Installation

| Check                                            | Result                                             |
| ------------------------------------------------ | -------------------------------------------------- |
| Install from published Git tag `v0.1.9`          | PASS — resolves version `0.1.9`, 0 vulnerabilities |
| Clean `npm ci --ignore-scripts` from tag         | PASS                                               |
| `npm run build` from tag                         | PASS                                               |
| `npm pack` from tag, then install packed tarball | PASS — resolves version `0.1.9`                    |
| Specification material in installed tarball tree | 0 files                                            |

## Published-package regression results

Reproduced against the package built from the published Git tag. Nothing in this suite imports the
development working tree.

| Behavior                                                                | Result |
| ----------------------------------------------------------------------- | ------ |
| Keyword-free arbitrary project script classifies as `UNKNOWN`           | PASS   |
| A script named `verify:offline` is classified from its definition       | PASS   |
| Arbitrary project script refused under `--offline`                      | PASS   |
| Decision reports `sandbox: "none"` and never claims isolation           | PASS   |
| `plannedCheckNetworkPolicy("UNKNOWN")` returns `UNKNOWN`                | PASS   |
| `plannedCheckNetworkPolicy` maps a provable exemption to `OFFLINE_SAFE` | PASS   |
| Keyword scanning escalates `UNKNOWN` to `NETWORK_REQUIRED`              | PASS   |
| No arbitrary definition reaches `OFFLINE_SAFE`                          | PASS   |
| Nothing executes under `--offline --allow-run`                          | PASS   |
| Offline-blocked check reaches the ledger as `BLOCKED` with a reason     | PASS   |
| A blocked check is never recorded `RUN`                                 | PASS   |
| A default audit stays static-only                                       | PASS   |
| An unauthorized check is `NOT_RUN`, never `BLOCKED`                     | PASS   |
| No `BLOCKED` finding enters the `forge fix` candidate set               | PASS   |
| Runtime evidence is refused offline rather than attempted               | PASS   |
| Incomplete rendered evidence fails closed                               | PASS   |
| A legacy schema 1 report migrates to schema 2                           | PASS   |
| Absent ledgers come back empty rather than fabricated                   | PASS   |
| Migration names the absent ledgers                                      | PASS   |

19/19 published-package checks passed.

The v0.1.7 structural security proof was re-verified independently against the published package
using a synthetic probe project:

| SSRF case                                                    | Result                            |
| ------------------------------------------------------------ | --------------------------------- |
| Unguarded request-controlled URL reaching `fetch` (baseline) | PASS — reported `FF-SEC-SSRF-001` |
| Constant-returning no-op `isPrivate` guard                   | PASS — still reported             |
| Guard imported from another module (`isInternal`)            | PASS — still reported             |

3/3 SSRF cases reported, including the positive baseline, so a zero-finding result cannot be misread
as a pass.

## Limitations carried into the release

- Forge implements no operating-system network isolation. `--offline` blocks `UNKNOWN` commands
  rather than sandboxing them, and the reported sandbox is always `none`. This is why every
  arbitrary audited-project command is refused offline rather than inspected and allowed.
- Rendered-state criteria remain `NOT_VERIFIED` wherever no trusted browser driver is available.
  Browser tooling is never installed automatically, and Forge never launches an application.
- A guard defined in another module is recorded as unverified rather than credited. This is
  intentional under-crediting.
- Discovery evidence classification and specification traceability validation remain open and are
  the subject of the next milestone.
- The deterministic-rebuild comparison was performed on Windows against a Linux-built release. macOS
  reproduction was not attempted and is `NOT_VERIFIED`.
- The private-specification scan is filename- and content-pattern based and would not detect a
  paraphrase.

The immutable v0.1.9 tag and release are unchanged by this document.
