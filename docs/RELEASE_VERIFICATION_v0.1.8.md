# Release verification — v0.1.8

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This is the tagged-source record. It contains complete local evidence gathered before the tag was
created, while remote CI, publication, provenance, and immutable-release checks remain explicitly
pending. The tag workflow generates a separate final evidence asset after draft assets have been
downloaded and verified; that final asset is not content of the original tag.

## Baseline and environment

| Item                            | Value                                |
| ------------------------------- | ------------------------------------ |
| Baseline `origin/main`          | `65ca20c` (merge of PR #24)          |
| Merge commit under release      | `ca1e310` (merge of PR #20)          |
| Previous release implementation | `v0.1.7`                             |
| Feature branch                  | `feature/v0.1.8-scope-report-schema` |
| OS                              | Windows 10 Pro 10.0.19045, x64       |
| Node.js                         | v24.14.1                             |
| npm                             | 11.11.0                              |

## Integration record

PR #20 was reviewed before merge. Its head at review time was `ddcb98c`. Released v0.1.7 `main` was
merged into the branch, producing three conflicts.

`CHANGELOG.md` conflicted as source and was resolved additively: the Unreleased v0.1.8 entries were
kept above the released 0.1.7 section, with no content from either side dropped.

`build/cli/src/cli.js.map` and `build/cli/src/gates.js.map` conflicted as generated output. They
were regenerated with `npm run build` rather than hand-merged. `cli/src/cli.ts` and
`cli/src/gates.ts` merged automatically with no manual intervention.

`cli/src/analyzers.ts` is not touched by this branch, so the v0.1.7 structural security proof
carries forward unchanged.

Two defects were found during integration review and corrected in `ad75a86` on the same branch:

- Report migration classified any report carrying an environment record as "inferred
  v0.1.6-compatible". v0.1.7 altered no report field, so a v0.1.7 report is indistinguishable from a
  v0.1.6 report at the schema level and naming only v0.1.6 was fabricated precision. The
  classification now names both releases and states why they cannot be told apart.
- v0.1.8 introduces a second, coarser network-policy vocabulary for `PlannedCheck`. No production
  code assigned it yet, so no live defect was reproducible, but the type alone permitted a future
  caller to describe an arbitrary audited-project command as `OFFLINE_SAFE`, silently undoing the
  v0.1.7 offline policy. `plannedCheckNetworkPolicy` is now the only sanctioned bridge between the
  vocabularies, it maps only the two structurally provable exemptions to `OFFLINE_SAFE`, and it
  always leaves `UNKNOWN` as `UNKNOWN`. There is no inverse and no promotion path.

## Intended behaviour change

PR #20 changed a pre-existing assertion in `cli/tests/cli.test.ts`. Under `--risk high`,
non-high-risk modules previously vanished from the report; they now appear as `NOT_VERIFIED` with an
`EXCLUDED_BY_RISK` module decision. This was confirmed as intended rather than an accidental
regression: absence of a module previously read as a positive result, which is exactly the class of
defect this release exists to close. The change is user-visible and is documented in
`docs/RELEASE_NOTES_v0.1.8.md` and `CHANGELOG.md`.

## Local validation

All commands were run from a clean `npm ci --ignore-scripts` state on the release branch.

| Check                        | Status | Evidence                                                      |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| `npm run format:check`       | PASS   |                                                               |
| `npm run lint`               | PASS   |                                                               |
| `npm run typecheck`          | PASS   |                                                               |
| `npm test`                   | PASS   | 366 tests, 0 failures, 0 skipped, 0 todo (v0.1.7 record: 322) |
| `npm run test:coverage`      | PASS   | lines 94.14%, branches 84.11%, functions 94.27%               |
| `npm run validate`           | PASS   | 43 canonical skills, 6 generated platform roots               |
| `npm run check`              | PASS   | aggregate of every project check                              |
| `npm run package:platforms`  | PASS   | 9 archives, 1050 entries, deterministic                       |
| `npm run validate:dist`      | PASS   | 9 archives, 0 symlinks                                        |
| `npm run smoke:install`      | PASS   | 0 symlinks, install records removed                           |
| `npm run offline:install`    | PASS   | 0 symlinks, uninstall clean                                   |
| `npm audit --ignore-scripts` | PASS   | 0 vulnerabilities                                             |
| `npm pack --dry-run --json`  | PASS   | no private specification material in the packed file list     |
| `npm run scan:secrets`       | PASS   | 776 files scanned, 0 findings                                 |

## Remote CI on the merge commit

Recorded on the pull-request head `9efb4e4`, which is the commit whose tree became `ca1e310`:

| Check                          | Result                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Verify (ubuntu-latest)         | SUCCESS                                                                     |
| Verify (windows-latest)        | SUCCESS                                                                     |
| Verify (macos-latest)          | SUCCESS                                                                     |
| CodeQL (JavaScript/TypeScript) | SUCCESS                                                                     |
| dependency-review              | SUCCESS on PR #20; skipped on push, which is the workflow's PR-only trigger |

## New regression coverage

| Area                 | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module applicability | `cli/tests/module-decision.test.ts` — independent capability and selection axes, `EXCLUDED_BY_RISK`, and the rule that a scoping decision never implies capability absence                                                                                                                                                                                                                                                                                                                                                                                          |
| Gate applicability   | `cli/tests/gate-applicability.test.ts` — a present-but-unaudited module leaves its capability gate active                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Ledger APIs          | `cli/tests/ledger.test.ts` — validation, stable-ID deduplication, deterministic order, and refusal to rewrite a blocked or unverified result as passing                                                                                                                                                                                                                                                                                                                                                                                                             |
| Report schema        | `cli/tests/report-schema.test.ts` — schema 2 shape, in-memory migration, and absent-ledger notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v0.1.7–v0.1.8 seam   | `cli/tests/cross-feature-v017-v018.test.ts` — a keyword-free arbitrary script stays `UNKNOWN` and blocked offline, a script named `verify:offline` is classified from its definition, `UNKNOWN` reaches the planned-check ledger as `UNKNOWN`, a blocked command yields no exit code and cannot become `PASS` runtime evidence, a blocked check cannot be re-recorded as `RUN`, a merely unexecuted command is `NOT_RUN` rather than `BLOCKED`, and a v0.1.7 report migrates with empty ledgers plus an explicit note that emptiness is not evidence the checks ran |

## Private specification

`FULLSTACK_FORGE_SPEC.md` is untracked, is not present in this worktree's index, and does not appear
in `git ls-files`. `npm pack --dry-run --json` confirms no specification file or specification
content appears in the packed file list, and `npm run scan:secrets` reports zero findings across 776
scanned files.

## Pending remote steps

The following remain PENDING at tag time and are recorded in the separate post-publication evidence
document, not in this tagged source:

- [ ] Immutable release publication
- [ ] Build-provenance attestation of published assets
- [ ] Checksum verification of published assets
- [ ] Download and verification of all nine published platform archives
- [ ] Installation from the published Git tag
- [ ] Installation from the packed tarball
- [ ] Reproduction of the corrected behaviors from published artifacts
- [ ] Confirmation that no private specification material appears in published assets
- [ ] Confirmation that historical tags remain unchanged
