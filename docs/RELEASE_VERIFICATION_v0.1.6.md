# Release verification — v0.1.6

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
| Baseline `origin/main`          | `cc7e9a1` (merge of PR #16)       |
| Previous release implementation | `v0.1.5`                          |
| Corrective branch               | `fix/v0.1.6-rendered-ui-security` |
| OS                              | Windows 10 Pro 10.0.19045, x64    |
| Node.js                         | v24.14.1                          |

## Untouched baseline

The untouched `cc7e9a1` checkout passed formatting, lint, type checking, 233/233 tests, coverage
(lines 90.75%, branches 82.08%, functions 91.64%), the aggregate `npm run check`, deterministic
packaging of all nine platform archives, dist validation, smoke installation, offline installation,
and `npm audit --ignore-scripts` with zero vulnerabilities.

No defect in this release is a pre-existing CI failure. Each was reproduced by direct inspection of
the v0.1.5 implementation and is covered by regression tests that fail against it:

- Offline enforcement existed only as a pre-navigation check on the initial URL; no request
  interception was installed at any point.
- `screenshots.length > 0` granted the rendered `PASS`, and the exit code depended only on console
  error count, so zero successful screenshots still exited `0`.
- `message.text()`, `error.message`, and viewport failure messages were written to evidence
  unredacted.

## Local validation after remediation

| Check                        | Status | Evidence                                                                         |
| ---------------------------- | ------ | -------------------------------------------------------------------------------- |
| `npm run format:check`       | PASS   |                                                                                  |
| `npm run lint`               | PASS   |                                                                                  |
| `npm run typecheck`          | PASS   |                                                                                  |
| `npm test`                   | PASS   | 281 tests, 0 failures, 0 skipped, 0 todo (baseline 233)                          |
| `npm run test:coverage`      | PASS   | lines 93.14%, branches 82.94%, functions 93.41% (baseline 90.75 / 82.08 / 91.64) |
| `npm run validate`           | PASS   |                                                                                  |
| `npm run check:platforms`    | PASS   |                                                                                  |
| `npm run check:links`        | PASS   |                                                                                  |
| `npm run check:licenses`     | PASS   |                                                                                  |
| `npm run check:fixtures`     | PASS   |                                                                                  |
| `npm run check:workflows`    | PASS   |                                                                                  |
| `npm run check:release-docs` | PASS   |                                                                                  |
| `npm run check:install-docs` | PASS   |                                                                                  |
| `npm run check:branding`     | PASS   |                                                                                  |
| `npm run scan:secrets`       | PASS   | 728 files scanned, 0 findings                                                    |
| `npm run check`              | PASS   |                                                                                  |
| `npm run package:platforms`  | PASS   | 9 archives, 1050 entries, deterministic                                          |
| `npm run validate:dist`      | PASS   | 9 archives, 0 symlinks                                                           |
| `npm run smoke:install`      | PASS   | 0 symlinks, install records removed                                              |
| `npm run offline:install`    | PASS   | 0 symlinks, uninstall clean                                                      |
| `npm audit --ignore-scripts` | PASS   | 0 vulnerabilities                                                                |
| `npm pack --dry-run --json`  | PASS   | no private specification material in the packed file list                        |

New coverage for this release: 48 tests across `cli/tests/net-policy.test.ts` (11),
`cli/tests/redaction.test.ts` (12), `cli/tests/rendered-ui-capture.test.ts` (17), and 8 end-to-end
tests appended to `cli/tests/rendered-ui.test.ts`.

## Coverage of the three mandatory areas

| Area                             | Regression coverage                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser-wide offline enforcement | Loopback classification across all documented spellings; private/link-local/public never loopback; blocked remote script, image, font, fetch/XHR, iframe, worker, and WebSocket; blocked redirect to a public host; assertion that no blocked destination reaches the network layer; refusal of a non-intercepting driver; online mode unchanged |
| Fail-closed capture              | Complete success; all navigations failing; one viewport succeeding; screenshot failure; screenshot producing no artifact; launch failure; page-creation failure; close failure; console errors; blocked resources; manifest/CLI status agreement; exit codes; close called exactly once                                                          |
| Evidence redaction               | Sentinels in console logs, console errors, page errors, query values, fragments, userinfo, authorization and cookie strings, JWTs, WebSocket URLs, redirect destinations, and home paths, asserted absent from `console.json`, `manifest.json`, findings, limitations, and CLI JSON; safe diagnostics preserved; hash digests preserved          |

## Private specification

`FULLSTACK_FORGE_SPEC.md` remains untracked and listed in `.git/info/exclude`.
`npm pack --dry-run --json` confirms no specification file or specification content appears in the
packed file list, and `npm run scan:secrets` reports zero findings across 728 scanned files.

## Pending remote steps

The following remain PENDING at tag time and are recorded in the separate post-publication evidence
document, not in this tagged source:

- [ ] Linux, Windows, and macOS CI on the merge commit
- [ ] CodeQL analysis
- [ ] Dependency review
- [ ] Immutable release publication
- [ ] Checksum and attestation verification of published assets
- [ ] Download and verification of all nine published platform archives
- [ ] Installation from the published Git tag
- [ ] Reproduction of the three corrected behaviors from published artifacts
- [ ] Confirmation that no sentinel value appears in published assets
- [ ] Confirmation that historical tags remain unchanged
