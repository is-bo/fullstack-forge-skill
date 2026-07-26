# Fullstack Forge v0.1.10 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-20. This document was not present in the v0.1.10 tag and does
not replace the checksummed, attested evidence asset attached before immutable publication. It
records the independent post-publication checks performed against the published artifacts.

Every result below was observed directly by the integrator who authored this file, against assets
downloaded from the published release into an empty directory.

This release completes the discovery evidence classification and specification traceability
milestone only. The other deferred areas listed in `docs/AUDIT_CLASSIFICATION_v0.1.10.md` remain
open and are not covered here.

## Identity and remote state

| Item                      | Verified value                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Feature pull request      | [#22](https://github.com/is-bo/fullstack-forge-skill/pull/22)                                  |
| Release-prep pull request | [#29](https://github.com/is-bo/fullstack-forge-skill/pull/29)                                  |
| Feature merge commit      | `e373a2d` (merge of PR #22)                                                                    |
| Merge commit on `main`    | `2e749db36a272a7fd8b8513c05ff0379e0b5834b`                                                     |
| Annotated tag object      | `7e86b8294bc9886add2e640b75a61866b0503f6d`                                                     |
| Tag                       | `v0.1.10`, peels to `2e749db36a272a7fd8b8513c05ff0379e0b5834b`                                 |
| Release                   | [Fullstack Forge v0.1.10](https://github.com/is-bo/fullstack-forge-skill/releases/tag/v0.1.10) |
| Immutable release         | `true`; draft `false`; prerelease `false`                                                      |
| Published at              | 2026-07-20T04:30:13Z                                                                           |
| Release workflow run      | `29716977824` — conclusion `success`                                                           |
| Published assets          | 13 (9 platform archives, `SHA256SUMS.txt`, `manifest.json`, final evidence and its `.sha256`)  |

All eleven tags `v0.1.0`–`v0.1.10` were re-resolved after publication. The ten historical tag
objects and the commits they peel to are unchanged, including `v0.1.7` (`2a2e439` → `bb35a11`),
`v0.1.8` (`78064d3` → `87edc43`), and `v0.1.9` (`cb3b1f0` → `eed7c02`). Zero mismatches. The v0.1.7,
v0.1.8, and v0.1.9 releases each remain `draft=false`, `immutable=true`, with 13 assets.

## Continuous integration

| Check                                              | Result                   |
| -------------------------------------------------- | ------------------------ |
| CI — `Verify (ubuntu-latest)` @ `2e749db`          | PASS                     |
| CI — `Verify (windows-latest)` @ `2e749db`         | PASS                     |
| CI — `Verify (macos-latest)` @ `2e749db`           | PASS                     |
| CodeQL `Analyze JavaScript/TypeScript` @ `2e749db` | PASS                     |
| `release` workflow @ `v0.1.10`                     | PASS (run `29716977824`) |
| Dependency review @ `2e749db`                      | SKIPPED — PR-only action |
| Dependency review @ PR #29 head `22c5833`          | PASS                     |
| CI (all three platforms) + CodeQL @ PR #29 head    | PASS                     |
| CI (all three platforms) + CodeQL @ PR #22 head    | PASS                     |
| CI + CodeQL @ feature merge `e373a2d`              | PASS                     |
| Open Dependabot alerts                             | 0                        |
| Open secret-scanning alerts                        | 0                        |
| Open code-scanning alerts                          | 0                        |

As at v0.1.7 through v0.1.9, `dependency-review` reports `skipped` on the `main` commit because the
action only evaluates pull-request diffs and structurally cannot pass on a push. Its authoritative
result for this release is the `success` on the pull-request head. The `skipped` status is not
recorded as a pass.

## Artifact integrity

| Check                                           | Result                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| `sha256sum -c SHA256SUMS.txt`                   | PASS — 9/9 OK                                          |
| Final evidence asset vs. its `.sha256`          | PASS                                                   |
| `gh attestation verify`                         | PASS — resolves to `release.yml@refs/tags/v0.1.10`     |
| Attestation predicate                           | `https://slsa.dev/provenance/v1`                       |
| Published archives vs. local reproducible build | PASS — 9/9 byte-identical                              |
| Extraction of all nine archives                 | PASS — 370 files in `all`, 85 in each platform archive |
| Total files across extracted archives           | 1050                                                   |
| Symlinks in extracted trees                     | 0                                                      |
| NTFS reparse points in extracted trees          | 0                                                      |
| Private specification material in archives      | ABSENT — see below                                     |

Deterministic rebuild: the nine archives produced locally on Windows from the released tree were
compared byte-for-byte against the nine downloaded from the release. All nine were identical, so the
release archives reproduce exactly on a different operating system from the Linux runner that built
them.

## Private specification material

`FULLSTACK_FORGE_SPEC.md` is untracked, appears in no `git ls-files` output, is present in no
published archive, and is present in no packed tarball. The traceability matrix restates every
requirement in the maintainers' own words and quotes, reproduces, and references no specification
wording.

All nine archives were extracted and scanned. The string `FULLSTACK_FORGE_SPEC` occurs nine times,
once per archive, and every occurrence is in `docs/RELEASE_VERIFICATION_v0.1.10.md` in the sentence
stating that the specification file is untracked. That is a filename reference in the project's own
evidence document, not specification content. No specification content, structure, or unreleased
material appears in any published asset.

## Installation

| Check                                            | Result                                              |
| ------------------------------------------------ | --------------------------------------------------- |
| Install from published Git tag `v0.1.10`         | PASS — resolves version `0.1.10`, 0 vulnerabilities |
| Clean `npm ci --ignore-scripts` from tag         | PASS                                                |
| `npm run build` from tag                         | PASS                                                |
| `forge --version` from tag installation          | PASS — prints `0.1.10`                              |
| `npm pack` from tag, then install packed tarball | PASS — resolves version `0.1.10`                    |
| Specification material in installed tarball tree | 0 files                                             |

## Published-package regression results

Reproduced against the package built from the published Git tag. Nothing in this suite imports the
development working tree.

| Behavior                                                               | Result |
| ---------------------------------------------------------------------- | ------ |
| A `PRESENT` assessment activates the module capability axis            | PASS   |
| An `UNKNOWN` assessment never becomes a proven `ABSENT`                | PASS   |
| A modelled capability with no assessment is `UNKNOWN`                  | PASS   |
| `ABSENT` requires every workspace to prove absence                     | PASS   |
| An all-workspace `ABSENT` resolves to `ABSENT`                         | PASS   |
| `PRESENT` in any workspace wins                                        | PASS   |
| Only a proven-absent capability yields `NOT_APPLICABLE`                | PASS   |
| `UNKNOWN` yields `NOT_VERIFIED`, never `NOT_APPLICABLE`                | PASS   |
| An unmodelled capability falls back to the legacy presence map         | PASS   |
| A legacy profile without assessments still works                       | PASS   |
| v0.1.7 offline policy intact: an arbitrary script is still `UNKNOWN`   | PASS   |
| v0.1.8 bridge intact: `plannedCheckNetworkPolicy("UNKNOWN")` unchanged | PASS   |

12/12 published-package checks passed. The last two are cross-release non-regressions confirming
that neither the v0.1.7 offline command policy nor the v0.1.8 network-policy bridge was weakened by
this milestone.

## Published self-audit

`forge all audit` run from the published tag reports 48 findings: 2 `FAIL`, 32 `NOT_VERIFIED`, 14
`NOT_APPLICABLE` — identical to the pre-tag release candidate. Both `FAIL` findings are located
inside Forge's own analyzer test files and are the deliberately vulnerable sample sources and
`sentinel-` placeholder strings those tests write into temporary projects. They contain no real
credential; secret scanning reports zero findings and zero open alerts. Released v0.1.9 reports
eleven `FAIL` findings on the same self-audit, so this release reduces them to a strict subset.

## Traceability matrix

| Status                   | Count |
| ------------------------ | ----- |
| `COMPLIANT`              | 37    |
| `PARTIALLY_COMPLIANT`    | 36    |
| `NOT_VERIFIED`           | 2     |
| **Total**                | 75    |
| Integration placeholders | 0     |

Both `NOT_VERIFIED` entries carry `verification_scope: external`. `FF-GOV-06` (repository
description and topics) and `FF-BRAND-02` (social preview upload) are GitHub-hosted repository
settings that cannot be proven from repository contents. Neither is unfinished local work.

## Limitations carried into the release

- The evidence layer models sixteen capabilities while module decisions are gated on twenty-four.
  The other eight still use the legacy presence map. This is recorded rather than papered over: a
  capability the layer does not model produces no assessment, and that silence is not read as
  evidence.
- Forge implements no operating-system network isolation. `--offline` blocks `UNKNOWN` commands
  rather than sandboxing them, and the reported sandbox is always `none`.
- Rendered-state criteria remain `NOT_VERIFIED` wherever no trusted browser driver is available.
- A guard defined in another module is recorded as unverified rather than credited. This is
  intentional under-crediting.
- Two traceability requirements remain genuinely externally unverifiable, as recorded above.
- The deterministic-rebuild comparison was performed on Windows against a Linux-built release. macOS
  reproduction was not attempted and is `NOT_VERIFIED`.
- The private-specification scan is filename- and content-pattern based and would not detect a
  paraphrase.

The immutable v0.1.10 tag and release are unchanged by this document.
