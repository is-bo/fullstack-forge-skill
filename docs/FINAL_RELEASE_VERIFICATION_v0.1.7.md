# Fullstack Forge v0.1.7 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-20. This document was not present in the v0.1.7 tag and does
not replace the checksummed, attested evidence asset attached before immutable publication
(`FINAL_RELEASE_VERIFICATION_v0.1.7.md`, digest
`f51aa7fe3eff0ed99cba9666c3f8094f7026259c0d895a498cdde9ec8e9ed18b`). It records the independent
post-publication checks performed against the published artifacts.

Every result below was observed directly by the integrator who authored this file, against assets
downloaded from the published release into an empty directory. No earlier verification claim was
carried over as evidence.

This release completes the offline-command-policy and static-security-proof milestone only. The
other deferred specification areas listed in `docs/AUDIT_CLASSIFICATION_v0.1.7.md` remain open and
are not covered here.

## Identity and remote state

| Item                      | Verified value                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Feature pull request      | [#19](https://github.com/thethunderbolt/fullstack-forge-skill/pull/19)                                |
| Release-prep pull request | [#23](https://github.com/thethunderbolt/fullstack-forge-skill/pull/23)                                |
| Merge commit on `main`    | `bb35a119d00103f64221033e406d9f5e5b9b344f`                                                            |
| Annotated tag object      | `2a2e439eb8640533d0054cd9a729dfe4dca82743`                                                            |
| Tag                       | `v0.1.7`, peels to `bb35a119d00103f64221033e406d9f5e5b9b344f`                                         |
| Release                   | [Fullstack Forge v0.1.7](https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.7) |
| Immutable release         | `true`; draft `false`                                                                                 |
| Published at              | 2026-07-20T01:32:57Z                                                                                  |
| Release workflow run      | `29710011290` — conclusion `success`, head `bb35a11`                                                  |
| Published assets          | 13 (9 platform archives, `SHA256SUMS.txt`, `manifest.json`, final evidence and its `.sha256`)         |

All eight tags `v0.1.0`–`v0.1.7` were re-resolved after publication and compared against
`git ls-remote --tags origin`. Every tag object hash is identical locally and remotely, and every
tag is an annotated tag object. Historical tags are unchanged.

## Continuous integration

Check runs were read from the GitHub API for the exact commits involved.

| Check                                              | Result                   |
| -------------------------------------------------- | ------------------------ |
| CI — `Verify (ubuntu-latest)` @ `bb35a11`          | PASS                     |
| CI — `Verify (windows-latest)` @ `bb35a11`         | PASS                     |
| CI — `Verify (macos-latest)` @ `bb35a11`           | PASS                     |
| CodeQL `Analyze JavaScript/TypeScript` @ `bb35a11` | PASS                     |
| `release` workflow @ `bb35a11`                     | PASS (run `29710011290`) |
| Dependency review @ `bb35a11`                      | SKIPPED — see note       |
| Dependency review @ PR #23 head `7f3e69d`          | PASS                     |
| CodeQL @ PR #23 head `7f3e69d`                     | PASS                     |
| CI (all three platforms) @ PR #23 head             | PASS                     |
| Open Dependabot alerts                             | 0                        |
| Open secret-scanning alerts                        | 0                        |
| Open code-scanning alerts                          | 0                        |

Note on dependency review: the `dependency-review` check reports `skipped` on the `main` commit
because the action only evaluates pull-request diffs. Its authoritative result for this release is
the `success` conclusion on the pull-request head `7f3e69deb4ba1b8f13988410ae2d1a4a1775ef99`, which
is the commit whose tree became `bb35a11`. Reading the `main` check run alone would understate this
gate, so both are recorded.

## Artifact integrity

All 13 published assets were downloaded into an empty directory and verified independently of the
build that produced them.

| Check                                            | Result                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| `sha256sum -c SHA256SUMS.txt`                    | PASS — 9/9 OK                                          |
| Published checksums vs. local reproducible build | PASS — byte-identical for all nine archives            |
| `gh attestation verify` per archive              | PASS — 9/9 verified against the repository             |
| Attested subject digests vs. downloaded bytes    | PASS — all 11 published subjects matched               |
| `SHA256SUMS.txt` digest vs. attestation          | PASS — `edae6bf7…`                                     |
| `manifest.json` digest vs. attestation           | PASS — `f24fc537…`                                     |
| Final evidence asset vs. its `.sha256`           | PASS — `f51aa7fe…`                                     |
| Extraction of all nine archives                  | PASS — 370 files in `all`, 85 in each platform archive |
| Symlink entries in ZIP central directories       | 0 across all nine archives                             |
| Symlinks in extracted trees                      | 0                                                      |
| NTFS reparse points in extracted trees           | 0                                                      |
| Private specification material in archives       | ABSENT — see below                                     |

Deterministic rebuild: the `v0.1.7` tag was cloned into an empty directory,
`npm ci --ignore-scripts` and `npm run package:platforms` were run on Windows, and the nine
resulting archives were compared by SHA-256 against the published `SHA256SUMS.txt`. All nine matched
exactly, so the release archives reproduce byte-for-byte on a different operating system from the
Linux runner that built them.

Observation: `fullstack-forge-antigravity`, `fullstack-forge-codex`, and `fullstack-forge-generic`
share the identical digest `86c3bd65433967ee46c6082b3fe3b4c340584d718929ca7bb33e7540b6c2e2c9`. These
three platform bundles are byte-identical by construction, and the same relationship holds in the
independent local rebuild, so this is a property of the packaging inputs rather than an upload
error.

The attestation resolves to
`https://github.com/thethunderbolt/fullstack-forge-skill/.github/workflows/release.yml@refs/tags/v0.1.7`
with source repository digest `bb35a119d00103f64221033e406d9f5e5b9b344f`.

## Private specification material

`FULLSTACK_FORGE_SPEC.md` is untracked and ignored, and it does not appear in any published archive
or in the packed tarball. A stronger content-level check was also performed: 134 distinctive prose
lines were extracted from the private specification and searched across all 23,310,563 bytes of text
in the extracted archives.

Five lines matched. All five are intentional public product content, not specification leakage:

- Four are behavioral operating rules that the specification requires the product to implement
  verbatim, and they are present in 43 tracked public source files each under `src/`.
- One is a generic GitHub navigation instruction in `docs/RELEASING.md`, tracked and public.

The only occurrence of the string `FULLSTACK_FORGE_SPEC` in the archives is in
`docs/RELEASE_VERIFICATION_v0.1.7.md`, where it states that the file is untracked. No specification
content is quoted. No specification section structure, roadmap, or unreleased material appears in
any published asset.

## Installation

| Check                                              | Result                                                |
| -------------------------------------------------- | ----------------------------------------------------- |
| Install from published Git tag `v0.1.7`            | PASS — resolves version `0.1.7`, 0 vulnerabilities    |
| `forge --version` from tag installation            | PASS — prints `0.1.7`                                 |
| `npm pack` from clean `v0.1.7` clone               | PASS — 568 entries, 0 symlinks, 0 specification files |
| Packed-tarball installation into empty project     | PASS — resolves `0.1.7`, 0 vulnerabilities            |
| `forge --version` from tarball installation        | PASS — prints `0.1.7`                                 |
| `forge --help` from tarball installation           | PASS — banner reports `Fullstack Forge 0.1.7`         |
| `offline-policy` module present in published build | PASS                                                  |
| `isModeledAddressGuard` present in published build | PASS                                                  |

## Published-package regression results

The two corrected v0.1.7 behaviors were reproduced against the package installed from the published
Git tag. Nothing in this suite imports the development working tree.

### Offline command policy (Correction 2)

| Behavior                                                           | Result |
| ------------------------------------------------------------------ | ------ |
| Keyword-free arbitrary project script classifies as `UNKNOWN`      | PASS   |
| Keyword-free arbitrary project script is blocked under `--offline` | PASS   |
| Decision reports `sandbox: "none"` and never claims isolation      | PASS   |
| A script _named_ `verify:offline` is still `UNKNOWN`               | PASS   |
| A script _named_ `verify:offline` is still blocked offline         | PASS   |
| The same script is permitted when not offline                      | PASS   |

6/6 passed. The published `offline-policy.d.ts` states the intended model directly: the only
permitted classifications are `forge-internal-offline-safe` and `cache-only-installation`, every
other audited-project command is `UNKNOWN`, no operating-system network isolation is implemented or
claimed, and a blocked command produces a ledger record rather than a command result — so it cannot
become PASS gate evidence. Classification never depends on the command's name, which the two
`verify:offline` cases confirm behaviorally.

### Static security proof (Correction 1)

Fixtures were analyzed with `runNamedAnalyzer("js-ts-security", …)` from the published build. A
positive baseline is included so that a zero-finding result cannot be misread as a pass.

| Behavior                                                             | Result |
| -------------------------------------------------------------------- | ------ |
| Baseline: unguarded request-controlled URL reports `FF-SEC-SSRF-001` | PASS   |
| No-op `isPrivate` / `isLinkLocal` helpers still report SSRF          | PASS   |
| Constant-returning guard body is rejected; SSRF still reported       | PASS   |
| Guard imported from another module stays unverified; SSRF reported   | PASS   |

4/4 passed. Generic name-based security proof remains removed in the published artifact.

## Limitations carried into the release

- Forge implements no operating-system network isolation. `--offline` blocks `UNKNOWN` commands
  rather than sandboxing them, and the published type declarations state this explicitly.
- Text inspection can prove network dependence but can never prove an arbitrary audited-project
  script is offline-safe, so keyword absence never downgrades a command to `OFFLINE_SAFE`.
- An address guard defined in another module is recorded as unverified rather than credited. This is
  intentional under-crediting: cross-module guard resolution is not modeled.
- Address-guard recognition requires a supported same-file implementation that takes the value,
  references the parameter, and decides against concrete non-public address evidence. Guards written
  in unsupported forms are not credited.
- The deterministic-rebuild comparison was performed on Windows against a Linux-built release. It
  confirms archive reproducibility across those two platforms; macOS reproduction was not attempted
  and is `NOT_VERIFIED`.
- The private-specification content scan compares distinctive prose lines. A paraphrase of
  specification material would not be detected by this method.

The immutable v0.1.7 tag and release are unchanged by this document.
