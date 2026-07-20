# Fullstack Forge v0.1.8 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-20. This document was not present in the v0.1.8 tag and does
not replace the checksummed, attested evidence asset attached before immutable publication. It
records the independent post-publication checks performed against the published artifacts.

Every result below was observed directly by the integrator who authored this file, against assets
downloaded from the published release into an empty directory.

This release completes the module applicability and report evidence ledger milestone only. The other
deferred specification areas listed in `docs/AUDIT_CLASSIFICATION_v0.1.8.md` remain open and are not
covered here.

## Identity and remote state

| Item                      | Verified value                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Feature pull request      | [#20](https://github.com/thethunderbolt/fullstack-forge-skill/pull/20)                                |
| Release-prep pull request | [#25](https://github.com/thethunderbolt/fullstack-forge-skill/pull/25)                                |
| Merge commit on `main`    | `87edc43684ec31c9c3afd6afc5a892e2b987088b`                                                            |
| Annotated tag object      | `78064d3f079d5d595c8f92a8c5fa2c640c9042bb`                                                            |
| Tag                       | `v0.1.8`, peels to `87edc43684ec31c9c3afd6afc5a892e2b987088b`                                         |
| Release                   | [Fullstack Forge v0.1.8](https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.8) |
| Immutable release         | `true`; draft `false`                                                                                 |
| Published at              | 2026-07-20T02:53:25Z                                                                                  |
| Release workflow run      | `29713381808` — conclusion `success`                                                                  |
| Published assets          | 13 (9 platform archives, `SHA256SUMS.txt`, `manifest.json`, final evidence and its `.sha256`)         |

All nine tags `v0.1.0`–`v0.1.8` were re-resolved after publication and compared against
`git ls-remote --tags origin`. Nine tags checked, zero mismatches. Historical tags are unchanged.

## Continuous integration

| Check                                              | Result                   |
| -------------------------------------------------- | ------------------------ |
| CI — `Verify (ubuntu-latest)` @ `87edc43`          | PASS                     |
| CI — `Verify (windows-latest)` @ `87edc43`         | PASS                     |
| CI — `Verify (macos-latest)` @ `87edc43`           | PASS                     |
| CodeQL `Analyze JavaScript/TypeScript` @ `87edc43` | PASS                     |
| `release` workflow @ `87edc43`                     | PASS (run `29713381808`) |
| Dependency review @ `87edc43`                      | SKIPPED — PR-only action |
| Dependency review @ PR #25 head `4f02cc8`          | PASS                     |
| CI (all three platforms) + CodeQL @ PR #25 head    | PASS                     |
| CI (all three platforms) + CodeQL @ PR #20 head    | PASS                     |
| Open Dependabot alerts                             | 0                        |
| Open secret-scanning alerts                        | 0                        |
| Open code-scanning alerts                          | 0                        |

As at v0.1.7, `dependency-review` reports `skipped` on the `main` commit because the action only
evaluates pull-request diffs. Its authoritative result for this release is the `success` on the
pull-request head `4f02cc8`.

## Artifact integrity

| Check                                            | Result                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| `sha256sum -c SHA256SUMS.txt`                    | PASS — 9/9 OK                                          |
| Final evidence asset vs. its `.sha256`           | PASS                                                   |
| `gh attestation verify`                          | PASS — resolves to `release.yml@refs/tags/v0.1.8`      |
| Attested source repository digest                | `87edc43684ec31c9c3afd6afc5a892e2b987088b`             |
| Attested subject digests vs. downloaded archives | PASS — 9/9 matched, 0 mismatched                       |
| Published checksums vs. local reproducible build | PASS — 9/9 byte-identical                              |
| Extraction of all nine archives                  | PASS — 370 files in `all`, 85 in each platform archive |
| Symlink entries in ZIP central directories       | 0 across all nine archives                             |
| Symlinks in extracted trees                      | 0                                                      |
| NTFS reparse points in extracted trees           | 0                                                      |
| Private specification material in archives       | ABSENT — see below                                     |

Deterministic rebuild: the nine archives produced locally on Windows from the released tree were
compared by SHA-256 against the published `SHA256SUMS.txt`. All nine matched, so the release
archives reproduce byte-for-byte on a different operating system from the Linux runner that built
them.

## Private specification material

`FULLSTACK_FORGE_SPEC.md` is untracked and ignored and appears in no published archive. The same
content-level scan used for v0.1.7 was repeated: distinctive prose lines from the private
specification were searched across 23,379,998 bytes of extracted archive text.

Five lines matched, and they are the same five identified and cleared at v0.1.7: four are behavioral
operating rules the specification requires the product to implement verbatim, present in tracked
public source, and one is a generic GitHub navigation instruction in `docs/RELEASING.md`. No
specification content, structure, or unreleased material appears in any published asset.

## Installation

| Check                                   | Result                                             |
| --------------------------------------- | -------------------------------------------------- |
| Install from published Git tag `v0.1.8` | PASS — resolves version `0.1.8`, 0 vulnerabilities |
| `forge --version` from tag installation | PASS — prints `0.1.8`                              |

## Published-package regression results

Reproduced against the package installed from the published Git tag. Nothing in this suite imports
the development working tree.

| Behavior                                                                | Result |
| ----------------------------------------------------------------------- | ------ |
| Keyword-free arbitrary project script classifies as `UNKNOWN`           | PASS   |
| Keyword-free arbitrary project script is blocked under `--offline`      | PASS   |
| A script named `verify:offline` is still blocked                        | PASS   |
| Decision reports `sandbox: "none"` and never claims isolation           | PASS   |
| `plannedCheckNetworkPolicy("UNKNOWN")` returns `UNKNOWN`                | PASS   |
| `plannedCheckNetworkPolicy` maps a provable exemption to `OFFLINE_SAFE` | PASS   |
| A legacy report migrates to schema 2                                    | PASS   |
| Absent ledgers come back empty rather than fabricated                   | PASS   |
| The v0.1.7 execution ledger survives migration                          | PASS   |
| Emptiness is stated as untracked, not as evidence of passing            | PASS   |
| A v0.1.7 report is not mislabelled as v0.1.6                            | PASS   |
| Unguarded request-controlled URL still reports SSRF (baseline)          | PASS   |
| No-op `isPrivate` / `isLinkLocal` helpers still report SSRF             | PASS   |
| Constant-returning guard body still reports SSRF                        | PASS   |
| Cross-module imported guard still reports SSRF                          | PASS   |

15/15 published-package checks passed. The four SSRF cases include a positive baseline so that a
zero-finding result cannot be misread as a pass.

## Limitations carried into the release

- Planned checks, execution, blocked checks, and runtime evidence are not yet connected to the
  report by the audit itself. Schema 2 provides the slots; the wiring is the next milestone. Until
  then the `planned_checks` and `runtime_evidence` ledgers are populated only by direct API callers,
  and the v0.1.7 command ledger still surfaces in ship results and tool output rather than in
  `AuditReport`.
- Forge implements no operating-system network isolation. `--offline` blocks `UNKNOWN` commands
  rather than sandboxing them.
- A guard defined in another module is recorded as unverified rather than credited. This is
  intentional under-crediting.
- The deterministic-rebuild comparison was performed on Windows against a Linux-built release. macOS
  reproduction was not attempted and is `NOT_VERIFIED`.
- The private-specification content scan is line-exact and would not detect a paraphrase.

The immutable v0.1.8 tag and release are unchanged by this document.
