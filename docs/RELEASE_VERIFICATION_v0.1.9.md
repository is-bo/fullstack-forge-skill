# Release verification — v0.1.9

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
| Baseline `origin/main`          | `7056cbb` (merge of PR #26)          |
| Merge commit under release      | `bff962a` (merge of PR #21)          |
| Previous release implementation | `v0.1.8`                             |
| Feature branch                  | `feature/v0.1.9-audit-orchestration` |
| Feature branch head at review   | `4d4655a`; merged head `95643ed`     |
| OS                              | Windows 10 Pro 10.0.19045, x64       |
| Node.js                         | v24.14.1                             |
| npm                             | 11.11.0                              |

## Integration record

PR #21 was reviewed before merge. Its head at review time was `4d4655a`. Released v0.1.8 `main` was
merged into the branch, producing four conflicts.

`CHANGELOG.md` conflicted as source and was resolved additively: the Unreleased v0.1.9 entries were
kept above the released 0.1.8 section, with no content from either side dropped.

`build/cli/src/cli.js`, `build/cli/src/cli.js.map`, and `build/cli/src/types.js.map` conflicted as
generated output. They were regenerated with `npm run build` rather than hand-merged.
`cli/src/cli.ts` and `cli/src/types.ts` merged automatically with no manual intervention.

The branch's temporary integration adapters were replaced with the final v0.1.8 APIs:

- `DefaultAuditLedger`, which wrote into the pre-v0.1.8 schema, was replaced by `ReportAuditLedger`.
  It writes the typed `planned_checks`, `runtime_evidence`, and `tools` ledgers through
  `createPlannedCheck`, `recordExecutedCheck`, `recordBlockedCheck`, `appendRuntimeEvidence`, and
  `appendToolRecord`, and reaches the report through the trailing `ledgers` argument to
  `createReport`. `orchestrateAudit` itself is unchanged, which is what the `AuditLedgerSink`
  boundary existed to make possible.
- The duplicate temporary `PlannedCheck` type was removed. Orchestration's planning struct is now
  `PlannedAuditCheck`; the report type is the v0.1.8 `PlannedCheck` from `cli/src/types.ts`.
- `module_decisions` from `decideModules` continue to reach the report unchanged.

`cli/src/analyzers.ts` is not touched by this branch, so the v0.1.7 structural security proof
carries forward unchanged.

## Release-blocking defect found during integration

Planning derived a boolean `network_dependent` flag from keyword scanning alone. A project script
whose definition contained no recognizable network keyword — `eslint .`, `vitest run`, `tsc -p .` —
was therefore executed under `--offline --allow-run`. This was reproduced against branch head
`4d4655a` before it was fixed.

Inspecting text can prove that a command reaches the network; it can never prove that it does not.
Fullstack Forge implements no operating-system network isolation, so nothing made the guess safe.
The branch's own test suite asserted the defective behaviour, which is why every single-branch check
stayed green.

Planned checks now carry a `network_policy` obtained exclusively through `plannedCheckNetworkPolicy`
— the bridge v0.1.8 introduced for exactly this purpose. Keyword scanning may only escalate
`UNKNOWN` to `NETWORK_REQUIRED`. Nothing may downgrade a command to `OFFLINE_SAFE`. The offline gate
now applies to every check whose policy is not `OFFLINE_SAFE`, including runtime evidence, which was
previously still attempted offline.

The sandbox remains, and is reported as, `none`.

## Intended behaviour change

`forge <section> audit --offline --allow-run` now refuses project commands that earlier builds of
this branch would have executed. The pre-existing branch test
`offline refuses an authorized network-dependent command before spawning it` asserted that `lint`
and `test` still ran; it was updated to assert that they are blocked. This was confirmed as the
intended correction rather than an accidental regression: executing an unproven command offline is
exactly the class of defect the v0.1.7 policy exists to prevent. The change is user-visible and is
documented in `docs/RELEASE_NOTES_v0.1.9.md` and `CHANGELOG.md`.

## Local validation

All commands were run from a clean `npm ci --ignore-scripts` state on the release branch.

| Check                        | Status | Evidence                                                      |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| `npm run format:check`       | PASS   |                                                               |
| `npm run lint`               | PASS   |                                                               |
| `npm run typecheck`          | PASS   |                                                               |
| `npm test`                   | PASS   | 436 tests, 0 failures, 0 skipped, 0 todo (v0.1.8 record: 366) |
| `npm run test:coverage`      | PASS   | lines 94.41%, branches 84.86%, functions 94.66%               |
| `npm run validate`           | PASS   | 43 canonical skills, 6 generated platform roots               |
| `npm run check`              | PASS   | aggregate of every project check                              |
| `npm run package:platforms`  | PASS   | 9 archives, deterministic                                     |
| `npm run validate:dist`      | PASS   | 9 archives, 0 symlinks                                        |
| `npm run smoke:install`      | PASS   | 0 symlinks, install records removed                           |
| `npm run offline:install`    | PASS   | 0 symlinks, uninstall clean                                   |
| `npm audit --ignore-scripts` | PASS   | 0 vulnerabilities                                             |
| `npm pack --dry-run --json`  | PASS   | no private specification material in the packed file list     |
| `npm run scan:secrets`       | PASS   | 0 findings                                                    |

Coverage moved up from the v0.1.8 record of lines 94.14%, branches 84.11%, functions 94.27%.

## Remote CI on the merge commit

Recorded on the pull-request head `95643ed`, which is the commit whose tree became `bff962a`:

| Check                          | Result                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Verify (ubuntu-latest)         | SUCCESS                                                                     |
| Verify (windows-latest)        | SUCCESS                                                                     |
| Verify (macos-latest)          | SUCCESS                                                                     |
| CodeQL (JavaScript/TypeScript) | SUCCESS                                                                     |
| dependency-review              | SUCCESS on PR #21; skipped on push, which is the workflow's PR-only trigger |

`dependency-review` evaluates a pull-request diff and structurally cannot pass on a push, so the
PR-head result is the authoritative one. The `skipped` status on `main` is not recorded as a pass.

## New regression coverage

| Area               | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1.7–v0.1.9 seam | `cli/tests/cross-feature-v017-v019.test.ts` — orchestration never invents `OFFLINE_SAFE` for an audited project's own scripts; keyword scanning escalates but never downgrades; a blocked offline check produces no `RUN` status and no `PASS` finding; an unauthorized check is `NOT_RUN` rather than `BLOCKED`; a normal audit stays static-only; rendered evidence integrates without auto-starting servers; incomplete rendered evidence fails closed; runtime evidence is refused rather than attempted offline; executed project commands are recorded as untrusted project-owned tools |
| Offline policy     | `cli/tests/audit-orchestration.test.ts` — a keyword-free arbitrary project script stays `UNKNOWN` and is still blocked under `--offline`; no arbitrary definition reaches `OFFLINE_SAFE`; a blocked check reaches the ledger as `BLOCKED` with `UNKNOWN` policy                                                                                                                                                                                                                                                                                                                               |
| Report schema      | `cli/tests/report-output.test.ts`, `cli/tests/cli-report-mode.test.ts` — written output and `--json` output both carry the canonical `REPORT_SCHEMA_VERSION`                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Private specification

`FULLSTACK_FORGE_SPEC.md` is untracked, is not present in this worktree's index, and does not appear
in `git ls-files`. `npm pack --dry-run --json` confirms no specification file or specification
content appears in the packed file list, and `npm run scan:secrets` reports zero findings.

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
