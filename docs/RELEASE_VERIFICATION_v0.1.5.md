# Release verification — v0.1.5

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This is the tagged-source record. It contains complete local evidence gathered before the tag was
created, while remote CI, publication, provenance, and immutable-release checks remain explicitly
pending. The tag workflow generates a separate final evidence asset after draft assets have been
downloaded and verified; that final asset is not content of the original tag.

## Baseline and environment

| Item                            | Value                          |
| ------------------------------- | ------------------------------ |
| Baseline `origin/main`          | `df273500` (merge of PR #14)   |
| Previous release implementation | `v0.1.4`                       |
| Corrective branch               | `fix/v0.1.5-spec-compliance`   |
| OS                              | Windows 10 Pro 10.0.19045, x64 |
| Node.js                         | v24.14.1                       |
| TypeScript                      | 6.0.3                          |

## Untouched baseline

The untouched `df27350` checkout passed formatting, lint, type checking, 219/219 tests, coverage
(lines 91.35%, branches 82.36%, functions 92.05%), validation, platform synchronization, link
checks, license checks for 91 dependency packages, fixture checks, workflow policy, release-doc
validation, branding, secret scanning, and `npm audit --ignore-scripts` with zero vulnerabilities.
No defect in this release is a pre-existing CI failure; each was reproduced by direct inspection and
by a regression test that fails against the baseline implementation.

## Local validation after remediation

| Check                        | Status | Evidence                                                                       |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ |
| `npm run format:check`       | PASS   |                                                                                |
| `npm run lint`               | PASS   |                                                                                |
| `npm run typecheck`          | PASS   |                                                                                |
| `npm test`                   | PASS   | 233 tests, 0 failures, 0 skipped, 0 todo (baseline 219)                        |
| `npm run test:coverage`      | PASS   | lines 90.75%, branches 82.08%, functions 91.64% against blocking thresholds    |
| `npm run validate`           | PASS   |                                                                                |
| `npm run check:platforms`    | PASS   |                                                                                |
| `npm run check:links`        | PASS   |                                                                                |
| `npm run check:licenses`     | PASS   | 91 dependency packages, allowed licenses only                                  |
| `npm run check:fixtures`     | PASS   | 12 non-installable fixture manifests; no dependency roots or fixture lockfiles |
| `npm run check:workflows`    | PASS   | 3 workflows; immutable SHA pins and release-safety policy                      |
| `npm run check:release-docs` | PASS   | honest tagged documents; remote publication PENDING                            |
| `npm run check:install-docs` | PASS   | new check; 28 documents inspected                                              |
| `npm run check:branding`     | PASS   |                                                                                |
| `npm run scan:secrets`       | PASS   |                                                                                |
| `npm run smoke:install`      | PASS   | 0 symlinks                                                                     |
| `npm run offline:install`    | PASS   | cache-only install with unreachable registry; 0 symlinks; clean uninstall      |
| `npm audit --ignore-scripts` | PASS   | 0 vulnerabilities                                                              |

## Regression evidence for the corrected behavior

| Behavior                                                   | Evidence                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Remote URL refused offline even with `--allow-run`         | `offline mode refuses remote destinations even with --allow-run`; no DNS resolution attempted |
| Loopback still inspectable offline                         | `offline mode still permits loopback inspection and reaches driver resolution`                |
| Hostile project `playwright` not imported                  | Sentinel-writing package planted in `node_modules`; sentinel absent after the run             |
| Offline refuses audited-project driver under `--allow-run` | `offline mode refuses the audited-project driver even with --allow-run`                       |
| Dry run imports and launches nothing, writes nothing       | `dry run resolves no driver, imports nothing, and writes nothing`                             |
| URL credentials rejected and absent from output            | `URL credentials are rejected before any evidence path is derived`                            |
| Two routes and two runs stay distinguishable               | `distinct routes and repeated runs receive distinct evidence directories`                     |
| Query/fragment traversal contained                         | `query strings and fragments cannot escape the evidence directory`                            |
| Query values redacted, revision present in path            | `planned evidence paths carry the revision and redact query values`                           |
| Blocked inspection writes no `.forge` tree                 | `blocked inspection never creates a .forge evidence tree`                                     |
| Out-of-repository driver not loaded                        | `a symlinked project driver outside the repository is not loaded`                             |
| Nine reassuring-name SSRF forms still reported             | `reassuring names are never accepted as SSRF protection`                                      |
| Structurally proven fixed map still suppresses SSRF        | `a structurally proven fixed server-owned map still suppresses SSRF`                          |

## Pending remote steps

The following remain PENDING and are not claimed as complete in this tagged source:

- Remote CI on Linux, Windows, and macOS.
- CodeQL analysis on the merge commit.
- Dependency review.
- Release workflow execution, asset publication, checksums, and attestations.
- Immutable-release confirmation.
- Clean-room download, extraction, and installation of every published platform archive.
- Post-release verification of corrected behavior from the published artifacts.

## Bounded limitations

Rendered-UI evidence capture is `NOT_VERIFIED` in this repository's own validation because no
browser driver is installed and none is added as a dependency; the driver-trust behavior is verified
through resolution and import-refusal tests rather than through an actual browser launch. Analysis
remains bounded and intra-file. Several specification areas remain unimplemented and are recorded as
`NOT_VERIFIED` in `docs/AUDIT_CLASSIFICATION_v0.1.5.md` rather than represented as passing.
