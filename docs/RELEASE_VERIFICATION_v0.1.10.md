# Release verification — v0.1.10

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This is the tagged-source record. It contains complete local evidence gathered before the tag was
created, while remote CI, publication, provenance, and immutable-release checks remain explicitly
pending. The tag workflow generates a separate final evidence asset after draft assets have been
downloaded and verified; that final asset is not content of the original tag.

## Baseline and environment

| Item                            | Value                                    |
| ------------------------------- | ---------------------------------------- |
| Baseline `origin/main`          | `311d6ab` (merge of PR #28)              |
| Merge commit under release      | `e373a2d` (merge of PR #22)              |
| Previous release implementation | `v0.1.9`                                 |
| Feature branch                  | `feature/v0.1.10-discovery-traceability` |
| Feature branch head at review   | `c84e8ea`; merged head `cc4d693`         |
| OS                              | Windows 10 Pro 10.0.19045, x64           |
| Node.js                         | v24.14.1                                 |
| npm                             | 11.11.0                                  |

## Integration record

PR #22 was reviewed before merge. Its head at review time was `c84e8ea`. Released v0.1.9 `main` was
merged into the branch, producing two conflicts.

`CHANGELOG.md` conflicted as source and was resolved additively: the Unreleased v0.1.10 entries were
kept above the released 0.1.9 section, with no content from either side dropped.

`build/cli/src/types.js.map` conflicted as generated output and was regenerated with `npm run build`
rather than hand-merged. `cli/src/types.ts` merged automatically with no manual intervention.

Capability assessments were connected to the v0.1.8 module-decision schema. `capabilityStatusFor`
now prefers a `CapabilityAssessment` over the legacy presence map, projecting it onto the
module-decision capability axis; `decisionFindingStatus` remains the canonical mapping to
`NOT_APPLICABLE` and `NOT_VERIFIED`.

`cli/src/analyzers.ts` is not touched by this branch, so the v0.1.7 structural security proof
carries forward unchanged.

## Release-blocking defects found during integration

**An `UNKNOWN` assessment could have been reported as a proven `ABSENT`.** Projecting the assessment
onto the v0.1.8 decision axis without care reports `UNKNOWN` as `ABSENT`, which
`decisionFindingStatus` turns into `NOT_APPLICABLE` — the exact defect the v0.1.8 milestone exists
to close. The projection now never strengthens a claim: `UNKNOWN` stays `UNKNOWN`, `PRESENT` in any
workspace wins, and `ABSENT` requires every workspace to prove absence.

**Unmodelled capabilities would have been disabled permanently.** The evidence layer models sixteen
capabilities; module decisions are gated on twenty-four. The first implementation read the absence
of an assessment as `UNKNOWN`, which would have permanently disabled every module gated on the other
eight capabilities. This was reproduced by four pre-existing tests failing before it could ship. A
capability the evidence layer does not model now falls back to the legacy presence map.

## Traceability attribution corrections

All four `integration:` placeholders are replaced with exact merged files, tests, documentation, and
release evidence. `integration_placeholders` is empty.

Two attributions were self-declared inference and were wrong:

- `FF-MOD-15` (static security analyzer) is attributed to **v0.1.7 / PR #19**, not v0.1.9.
  `cli/src/analyzers.ts` first landed in `c8073ed` on `feature/v0.1.7-offline-security`.
- `FF-ORCH-01` (repository-wide orchestrator) is attributed to **v0.1.8 / PR #20** and **v0.1.9 / PR
  #21**, not v0.1.7. `cli/src/scope.ts` and `cli/src/ledger.ts` landed in `ddcb98c`;
  `cli/src/audit-orchestration.ts` landed with PR #21.

Every remaining attribution was re-checked against the commit that introduced each referenced file
rather than trusted. No requirement now cites release evidence predating a file it references.

## Local validation

All commands were run from a clean `npm ci --ignore-scripts` state on the release branch.

| Check                        | Status | Evidence                                                      |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| `npm run format:check`       | PASS   |                                                               |
| `npm run lint`               | PASS   |                                                               |
| `npm run typecheck`          | PASS   |                                                               |
| `npm test`                   | PASS   | 480 tests, 0 failures, 0 skipped, 0 todo (v0.1.9 record: 436) |
| `npm run test:coverage`      | PASS   | lines 94.68%, branches 85.40%, functions 94.72%               |
| `npm run validate`           | PASS   | 43 canonical skills, 6 generated platform roots               |
| `npm run check:traceability` | PASS   | 75 requirements, 0 integration placeholders                   |
| `npm run check`              | PASS   | aggregate of every project check                              |
| `npm run package:platforms`  | PASS   | 9 archives, deterministic                                     |
| `npm run validate:dist`      | PASS   | 9 archives, 0 symlinks                                        |
| `npm run smoke:install`      | PASS   | 0 symlinks, install records removed                           |
| `npm run offline:install`    | PASS   | 0 symlinks, uninstall clean                                   |
| `npm audit --ignore-scripts` | PASS   | 0 vulnerabilities                                             |
| `npm pack --dry-run --json`  | PASS   | no private specification material in the packed file list     |
| `npm run scan:secrets`       | PASS   | 830 files scanned, 0 findings                                 |

Coverage moved up from the v0.1.9 record of lines 94.41%, branches 84.86%, functions 94.66%.

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

## Release-candidate self-audit

`forge all audit` against this candidate reports 48 findings: 2 `FAIL`, 32 `NOT_VERIFIED`, 14
`NOT_APPLICABLE`.

Both `FAIL` findings are located entirely inside Forge's own analyzer test files and are the
deliberately vulnerable sample sources and `sentinel-` placeholder strings those tests write into
temporary projects to assert the analyzers detect exactly these patterns. They contain no real
credential. Released v0.1.9 reports eleven `FAIL` findings on the same self-audit; the two remaining
here are a strict subset, and the reduction is the evidence classification working as intended.
Neither meets the release-blocking bar.

## Remote CI on the merge commit

Recorded on the pull-request head `cc4d693`, which is the commit whose tree became `e373a2d`:

| Check                          | Result                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Verify (ubuntu-latest)         | SUCCESS                                                                     |
| Verify (windows-latest)        | SUCCESS                                                                     |
| Verify (macos-latest)          | SUCCESS                                                                     |
| CodeQL (JavaScript/TypeScript) | SUCCESS                                                                     |
| dependency-review              | SUCCESS on PR #22; skipped on push, which is the workflow's PR-only trigger |

`dependency-review` evaluates a pull-request diff and structurally cannot pass on a push, so the
PR-head result is the authoritative one. The `skipped` status on `main` is not recorded as a pass.

## New regression coverage

| Area                | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1.8–v0.1.10 seam | `cli/tests/cross-feature-v018-v0110.test.ts` — a `PRESENT` assessment activates the capability axis; an `UNKNOWN` assessment never becomes a proven `ABSENT`; a capability with no assessment is `UNKNOWN`; `ABSENT` requires every workspace to prove absence; one workspace proving `PRESENT` is enough; only a proven-absent capability yields `NOT_APPLICABLE`; documentation-, test-, fixture- and generated-only signals cannot activate a capability; a profile without assessments still uses the legacy map; an unmodelled capability falls back to the legacy map |
| Discovery evidence  | `cli/tests/discovery-evidence.test.ts` — evidence classification, activation weights, thresholds, workspace attribution                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Traceability        | `scripts/tests/traceability.test.mjs` — matrix validation rules, placeholder policy, and rendered-document synchronisation                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Private specification

`FULLSTACK_FORGE_SPEC.md` is untracked, is not present in this worktree's index, and does not appear
in `git ls-files`. The traceability matrix restates every requirement in the maintainers' own words
and quotes, reproduces, and references no specification wording. `npm pack --dry-run --json`
confirms no specification file or specification content appears in the packed file list, and
`npm run scan:secrets` reports zero findings across 830 scanned files.

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
