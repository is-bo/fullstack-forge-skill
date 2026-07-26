# Fullstack Forge v0.1.6 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-19. This document was not present in the v0.1.6 tag and does
not replace the checksummed, attested evidence asset attached before immutable publication. It
records the independent post-publication checks performed against the published artifacts.

This release completes the rendered-UI security milestone only. The other deferred specification
areas listed in `docs/AUDIT_CLASSIFICATION_v0.1.6.md` remain open and are not covered here.

## Identity and remote state

| Item                    | Verified value                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Corrective pull request | [#17](https://github.com/is-bo/fullstack-forge-skill/pull/17)                                 |
| Merge commit on `main`  | `6342b75d0b1d21f6ad67a02882a1fa55655aa996`                                                    |
| Annotated tag object    | `87fb334f24ab68caad49aa02dea5f51310b122ac`                                                    |
| Tag                     | `v0.1.6`, peels to `6342b75d0b1d21f6ad67a02882a1fa55655aa996`                                 |
| Release                 | [Fullstack Forge v0.1.6](https://github.com/is-bo/fullstack-forge-skill/releases/tag/v0.1.6)  |
| Immutable release       | `true`; draft `false`; prerelease `false`                                                     |
| Published assets        | 13 (9 platform archives, `SHA256SUMS.txt`, `manifest.json`, final evidence and its `.sha256`) |

Historical tags `v0.1.0`–`v0.1.5` were re-resolved after publication and are unchanged. The v0.1.5
release remains immutable and untouched.

## Continuous integration

| Check                       | Result                   |
| --------------------------- | ------------------------ |
| CI — `ubuntu-latest`        | PASS                     |
| CI — `windows-latest`       | PASS                     |
| CI — `macos-latest`         | PASS                     |
| CodeQL analysis             | PASS                     |
| CodeQL alert gate           | PASS — 0 open alerts     |
| Dependency review           | PASS                     |
| `main` CI after merge       | PASS (run `29685595221`) |
| `main` CodeQL after merge   | PASS (run `29685595205`) |
| Release workflow            | PASS (run `29685800703`) |
| Open Dependabot alerts      | 0                        |
| Open secret-scanning alerts | 0                        |
| Open code-scanning alerts   | 0                        |

One high-severity CodeQL alert (`js/incomplete-url-substring-sanitization`) was raised during review
against a new test assertion that searched URL text for a host literal. It was fixed by comparing
parsed `URL` hostnames instead, which is also the stronger assertion; the alert is resolved and no
alert was suppressed or dismissed.

## Artifact integrity

All nine published archives were downloaded into an empty directory and verified independently of
the build that produced them.

| Check                                            | Result                                         |
| ------------------------------------------------ | ---------------------------------------------- |
| `sha256sum -c SHA256SUMS.txt`                    | PASS — 9/9 OK                                  |
| Published checksums vs. local reproducible build | PASS — byte-identical for all nine archives    |
| `gh attestation verify` per archive              | PASS — 9/9 verified against the repository     |
| Extraction of all nine archives                  | PASS — 0 symlinks, 370 files in `all`, 85 each |
| Private specification material in archives       | ABSENT — no specification file present         |
| Test sentinel values in published assets         | ABSENT                                         |

## Installation

| Check                                    | Result                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| Install from published Git tag `v0.1.6`  | PASS — resolves version `0.1.6`, 0 vulnerabilities      |
| `net-policy`, `redaction`, `rendered-ui` | PASS — all three modules present in the published build |
| Offline installation from bundled assets | PASS — 0 symlinks, uninstall clean                      |
| Packed-tarball smoke installation        | PASS                                                    |

## Published-package regression results

The three corrected behaviors were reproduced against the package installed from the published Git
tag. Nothing in this suite imports the development working tree.

| Behavior                                                       | Result |
| -------------------------------------------------------------- | ------ |
| Loopback classification covers the full documented set         | PASS   |
| Private, link-local, and public destinations never loopback    | PASS   |
| Offline policy refuses non-loopback HTTP, HTTPS, and WebSocket | PASS   |
| Offline blocks every non-loopback request before the network   | PASS   |
| A blocked resource prevents a `COMPLETE` capture               | PASS   |
| Blocked request URLs are redacted                              | PASS   |
| A full capture reports `COMPLETE`                              | PASS   |
| Every viewport failing reports `FAILED`, not success           | PASS   |
| One viewport of three reports `PARTIAL`, never `COMPLETE`      | PASS   |
| A browser launch failure reports `FAILED`                      | PASS   |
| Credentials are redacted from evidence text                    | PASS   |
| URL userinfo, query values, and fragments are redacted         | PASS   |
| Hash digests and plain diagnostics survive redaction           | PASS   |

13/13 published-package checks passed.

## Limitations carried into the release

- WebSocket blocking relies on an in-page init script; a driver without `addInitScript` records the
  gap as `NOT_VERIFIED` rather than claiming coverage.
- WebRTC and browser-internal telemetry sit outside the interception boundary and are declared
  `NOT_VERIFIED`.
- Offline interception is verified at the `captureRenderedUi` seam rather than through
  `inspectRenderedUi`, because `--offline` refuses audited-project driver resolution by design.
- Redaction is structural; a secret that is neither credential-shaped nor in a recognized position
  is not detectable generically.
- Rendered-state criteria stay `NOT_VERIFIED` wherever no trusted browser driver is available, which
  is the expected outcome for this repository's own CI.

The immutable v0.1.6 tag and release are unchanged by this document.
