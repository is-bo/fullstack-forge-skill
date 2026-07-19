# Fullstack Forge v0.1.5 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-19. This document was not present in the v0.1.5 tag and does
not replace the checksummed, attested evidence asset attached before immutable publication. It
records the independent post-publication checks performed against the published artifacts.

## Identity and remote state

| Item                    | Verified value                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Corrective pull request | [#15](https://github.com/thethunderbolt/fullstack-forge-skill/pull/15)                                |
| Merge commit on `main`  | `eb80f209c5bb95b0e16e5983e2b133e437e3724f`                                                            |
| Annotated tag object    | `2e644e7d47872c7fd64684728a598d1344367089`                                                            |
| Tag                     | `v0.1.5`, peels to `eb80f209c5bb95b0e16e5983e2b133e437e3724f`                                         |
| Release                 | [Fullstack Forge v0.1.5](https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.5) |
| Immutable release       | `true`; draft `false`; prerelease `false`                                                             |
| Published assets        | 13 (9 platform archives, `SHA256SUMS.txt`, `manifest.json`, final evidence and its `.sha256`)         |

Historical tags `v0.1.0`–`v0.1.4` were re-resolved after publication and are unchanged. The v0.1.4
release remains immutable and untouched.

## Artifact integrity

All nine published archives were downloaded into an empty directory and verified independently of
the build that produced them.

| Check                                            | Result                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `sha256sum -c SHA256SUMS.txt`                    | PASS — 9/9 OK                                                            |
| Published checksums vs. local reproducible build | PASS — byte-identical; two independent local packaging runs also matched |
| `gh attestation verify` per archive              | PASS — 9/9 verified against the repository                               |
| Symlinks or reparse points in any archive        | PASS — 0 across all archives                                             |
| Private specification material in any archive    | PASS — 0 entries                                                         |
| Private specification in Git history             | PASS — never committed on any ref                                        |

## Platform archive matrix

| Archive       | Entries | Skills | Symlinks | Platform root                                                      |
| ------------- | ------- | ------ | -------- | ------------------------------------------------------------------ |
| `all`         | 370     | 258    | 0        | `.agents`, `.claude`, `.cursor`, `.gemini`, `.github`, `.windsurf` |
| `antigravity` | 85      | 43     | 0        | `.agents`                                                          |
| `claude`      | 85      | 43     | 0        | `.claude`                                                          |
| `codex`       | 85      | 43     | 0        | `.agents`                                                          |
| `cursor`      | 85      | 43     | 0        | `.cursor`                                                          |
| `gemini`      | 85      | 43     | 0        | `.gemini`                                                          |
| `generic`     | 85      | 43     | 0        | `.agents`                                                          |
| `github`      | 85      | 43     | 0        | `.github`                                                          |
| `windsurf`    | 85      | 43     | 0        | `.windsurf`                                                        |

## Corrected behavior verified from the published release

Installed with `npm install --save-dev github:thethunderbolt/fullstack-forge-skill#v0.1.5` into an
empty project; `forge --version` reported `0.1.5`. A hostile `playwright` package whose top-level
code writes a sentinel file was planted in the audited project's `node_modules`.

| Behavior                                                      | Result                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Loopback inspection with no `--allow-run`                     | BLOCKED; sentinel **not** written — audited-project code was not executed   |
| Dry run with `--allow-run`                                    | Planned paths returned; sentinel absent; no `.forge` directory created      |
| `--offline` against a remote URL with `--allow-run`           | BLOCKED before DNS resolution; `offline: true` recorded                     |
| `--offline` loopback driver resolution with `--allow-run`     | BLOCKED; sentinel absent                                                    |
| URL credentials (`http://user:pass@host/`)                    | Rejected before any evidence path was derived                               |
| No-op `mapDestination()` wrapping `req.query.url`             | `FF-SEC-SSRF-001` FAIL reported                                             |
| `const ALLOWED_DESTINATIONS = req.body` lookup                | `FF-SEC-SSRF-001` FAIL reported, distinct `instance_id`                     |
| `const` map of fixed https literals with `redirect: "manual"` | Correctly suppressed — the structural proof path still works                |
| Two routes inspected                                          | Distinct evidence directories                                               |
| Same route inspected twice                                    | Distinct run identifiers; route identity stable across both runs            |
| Query/fragment traversal (`?n=../../../etc/passwd#/../esc`)   | Contained under `.forge/evidence/ui/`; no `..` in the derived path          |
| `forge security audit --offline`                              | Completed; `environment.offline: true`, `environment.forge: 0.1.5` recorded |

## Repository security state after publication

| Item                        | State                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| Open Dependabot alerts      | 0                                                                                 |
| Open code-scanning alerts   | 0                                                                                 |
| Open secret-scanning alerts | 0                                                                                 |
| Open pull requests          | 0                                                                                 |
| Remote branches             | `main` only; the merged `fix/v0.1.3-correctness-audit` branch was deleted         |
| Branch protection           | Unchanged; six required checks, admins enforced, conversation resolution required |
| CI on the merge commit      | PASS (Linux, Windows, macOS), CodeQL PASS, dependency review PASS                 |

## Remaining limitations

Rendered-UI capture itself remains `NOT_VERIFIED`: no browser driver is installed alongside
Fullstack Forge and none is added as a dependency, so driver trust is proven through resolution and
import-refusal behavior rather than an actual browser launch. Several specification areas remain
unimplemented and are recorded as `NOT_VERIFIED` in `docs/AUDIT_CLASSIFICATION_v0.1.5.md` — notably
changed-scope applicability semantics, CLI orchestration of approved checks, the
`planned_checks`/`runtime_evidence` ledgers, the report-mode `--output` contract, and discovery
evidence classes. They are open product gaps, not unfinished work from this release.
