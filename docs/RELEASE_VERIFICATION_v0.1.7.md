# Release verification — v0.1.7

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This is the tagged-source record. It contains complete local evidence gathered before the tag was
created, while remote CI, publication, provenance, and immutable-release checks remain explicitly
pending. The tag workflow generates a separate final evidence asset after draft assets have been
downloaded and verified; that final asset is not content of the original tag.

## Baseline and environment

| Item                            | Value                             |
| ------------------------------- | --------------------------------- |
| Baseline `origin/main`          | `46b46cf` (merge of PR #18)       |
| Merge commit under release      | `3985b50` (merge of PR #19)       |
| Previous release implementation | `v0.1.6`                          |
| Feature branch                  | `feature/v0.1.7-offline-security` |
| OS                              | Windows 10 Pro 10.0.19045, x64    |
| Node.js                         | v24.14.1                          |
| npm                             | 11.11.0                           |

## Integration record

PR #19 was reviewed before merge. Its head at review time was `066a31f`. One release-blocking defect
was found during integration review and corrected in `c8073ed` on the same branch:

- SSRF address guards (`isPrivate`, `isLinkLocal`, `isInternal`, `privateAddress`) were still
  credited from the callee name alone. A no-op guard returning a constant suppressed the SSRF
  finding while blocking nothing, which contradicted the claim in `docs/SECURITY_MODEL.md` that no
  analyzer protection is granted from an identifier's name. The guard is now modeled from a
  same-file implementation, and an unmodeled or imported guard leaves the finding reported.

The defect is covered by three regression tests, including a positive case asserting that a genuine
structurally proven address guard still suppresses, so the fix is not a wholesale disablement of
address-guard recognition.

## Local validation

All commands were run from a clean `npm ci --ignore-scripts` state on the release branch.

| Check                        | Status | Evidence                                                      |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| `npm run format:check`       | PASS   |                                                               |
| `npm run lint`               | PASS   |                                                               |
| `npm run typecheck`          | PASS   |                                                               |
| `npm test`                   | PASS   | 322 tests, 0 failures, 0 skipped, 0 todo (v0.1.6 record: 281) |
| `npm run test:coverage`      | PASS   | lines 93.70%, branches 83.39%, functions 93.73%               |
| `npm run validate`           | PASS   | 43 canonical skills, 6 generated platform roots               |
| `npm run check`              | PASS   | aggregate of every project check                              |
| `npm run package:platforms`  | PASS   | 9 archives, 1050 entries, deterministic                       |
| `npm run validate:dist`      | PASS   | 9 archives, 0 symlinks                                        |
| `npm run smoke:install`      | PASS   | 0 symlinks, install records removed                           |
| `npm run offline:install`    | PASS   | 0 symlinks, uninstall clean                                   |
| `npm audit --ignore-scripts` | PASS   | 0 vulnerabilities                                             |
| `npm pack --dry-run --json`  | PASS   | no private specification material in the packed file list     |
| `npm run scan:secrets`       | PASS   | 751 files scanned, 0 findings                                 |

## Remote CI on the merge commit

Recorded on `3985b50` before tagging:

| Check                          | Result                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Verify (ubuntu-latest)         | SUCCESS                                                                     |
| Verify (windows-latest)        | SUCCESS                                                                     |
| Verify (macos-latest)          | SUCCESS                                                                     |
| CodeQL (JavaScript/TypeScript) | SUCCESS                                                                     |
| dependency-review              | SUCCESS on PR #19; skipped on push, which is the workflow's PR-only trigger |

## New regression coverage

| Area                      | Tests                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offline command policy    | `cli/tests/offline-policy.test.ts` — definition-based classification, deny-by-default `UNKNOWN`, exact-definition Forge exemption bound to the Forge package root, structural cache-only installation recognition, unreachable-registry classification, ledger dispositions, and the absence of typed evidence for a blocked command |
| Structural security proof | `cli/tests/security-proof.test.ts` — ten reassuringly named no-op helpers across SQL, shell, SSRF, redirect, mass-assignment, upload, and AI sinks; destination-map immutability, aliasing, export, and mutation defeats; address-guard modeling with no-op, unmodeled-import, and genuine-guard cases                               |

## Private specification

`FULLSTACK_FORGE_SPEC.md` is untracked, is not present in this worktree's index, and does not appear
in `git ls-files`. `npm pack --dry-run --json` confirms no specification file or specification
content appears in the packed file list, and `npm run scan:secrets` reports zero findings across 751
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
