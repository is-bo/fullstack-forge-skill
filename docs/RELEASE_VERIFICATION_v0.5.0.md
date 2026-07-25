# Release verification — v0.5.0

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

Release recommendation: GO FOR REVIEW, MERGE, AND REMOTE CI

This tagged-source record covers the local v0.5.0 candidate validated on 2026-07-25. Remote CI,
tagging, publication, provenance, immutability, and post-publication installation cannot be proven
in tagged source and remain pending for the release workflow.

## Environment

| Item               | Value                          |
| ------------------ | ------------------------------ |
| Baseline           | public v0.4.0 `main`           |
| Previous release   | `v0.4.0`                       |
| Integration branch | `codex/v0.5.0-product-polish`  |
| OS                 | Windows 10 Pro 10.0.19045, x64 |
| Node.js            | v24.14.1                       |
| npm                | 11.11.0                        |

## Product evidence

The initial comparison is `PRODUCT_GAP_REPORT_v0.5.0.md`; implementation boundaries are in
`PRODUCT_LAYER_DESIGN_v0.5.0.md`; final dispositions are in `AUDIT_CLASSIFICATION_v0.5.0.md`. The
public traceability matrix now includes six independently worded product-layer requirements without
quoting or publishing private source-of-truth material.

## Local validation

All completed rows passed against candidate content. One Windows symlink test is expected to skip
when the account lacks symbolic-link privilege; clean installs separately inspect for reparse
points.

| Command or evidence                         | Result | Decisive output                                                                                               |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`, lint, and typecheck | PASS   | formatting clean; zero lint/type errors                                                                       |
| `npm test`                                  | PASS   | 702 tests; 701 passed, 0 failed, 1 expected Windows symlink skip                                              |
| `npm run test:evals:v030`                   | PASS   | 44/44 legacy Build and prevention evaluations                                                                 |
| `npm run test:coverage`                     | PASS   | lines 94.16%, branches 83.09%, functions 93.80%                                                               |
| canonical and generated validation          | PASS   | 46 skills; 106 files synchronized across six roots                                                            |
| traceability validation                     | PASS   | 87 requirements; 49 compliant, 36 partial, 2 externally not verified                                          |
| dependency audit                            | PASS   | zero known vulnerabilities                                                                                    |
| secret scan                                 | PASS   | all declared repository files scanned with zero findings                                                      |
| interactive terminal probe                  | PASS   | menu rendered in a Windows PTY; choice 0 cancelled with no changes                                            |
| simplified command matrix                   | PASS   | Build, Continue, Audit, Fix, Verify, Ship, Status, Help, Doctor, typo, ambiguity, and failure paths exercised |
| package, archive, and clean install gates   | PASS   | deterministic archives, checksums, first-party, offline, skills-only, and upgrade lifecycles validated        |
| independent `forge ship --allow-run --json` | PASS   | all required local Forge release gates passed in a clean candidate copy                                       |
| final `npm run check`                       | PASS   | complete fail-closed repository gate passed after the final authored edit                                     |

Archive digests are not embedded here because this document is itself archived. Candidate
`dist/SHA256SUMS.txt` and `dist/manifest.json` bind the validated bytes; a release workflow must
independently download and compare future published assets.

## Installation matrix

| Boundary                            | Result         | Evidence or limitation                                                               |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| first-party local npm package       | PASS           | install, init, Doctor, update, reinstall, dry-run, tamper protection, and uninstall  |
| first-party isolated global install | PASS           | isolated user root, exact global destinations, Doctor, update, and clean uninstall   |
| cache-only offline install          | PASS           | unreachable registry with warmed dependency; no network success inferred             |
| third-party `skills` CLI v1.5.20    | PASS           | local candidate copied all 46 skills; no reparse points                              |
| previous public release upgrade     | PASS           | v0.4.0 manifest and files upgraded to v0.5.0, verified, and uninstalled              |
| local release archives              | PASS           | nine ZIPs (all plus eight selectors), checksums, inventory, and extraction validated |
| public v0.5.0 Git tag/release       | PENDING        | the immutable remote tag and release do not yet exist                                |
| public npm registry                 | NOT_APPLICABLE | the package is intentionally distributed from GitHub                                 |

## Platform-support matrix

| Platform                     | Structure/install result | Live host result                    |
| ---------------------------- | ------------------------ | ----------------------------------- |
| Codex / generic Agent Skills | PASS                     | NOT_VERIFIED — host UI not launched |
| Claude Code                  | PASS                     | NOT_VERIFIED — host UI not launched |
| Cursor                       | PASS                     | NOT_VERIFIED — host UI not launched |
| Gemini CLI                   | PASS                     | NOT_VERIFIED — host UI not launched |
| Antigravity                  | PASS                     | NOT_VERIFIED — host UI not launched |
| Windsurf                     | PASS                     | NOT_VERIFIED — host UI not launched |
| GitHub Copilot               | PASS                     | NOT_VERIFIED — host UI not launched |

`PASS` in the structure column means canonical/generated bytes, ownership metadata, documented
paths, selector behavior, and packaged structure were directly validated. It does not stand in for
vendor host execution.

## Simplified-command acceptance

| User command                     | Result | Verified behavior                                                             |
| -------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `forge`                          | PASS   | interactive menu in a PTY; simple command list in noninteractive execution    |
| `forge build [request]`          | PASS   | ordinary-language frame, safe slug, risk tier, and next action                |
| `forge continue`                 | PASS   | unique unfinished feature resumed; ambiguity remains a refusal                |
| `forge audit` / `all` / `<area>` | PASS   | reliable scope fallback, applicable modules, and bounded aliases/conjunctions |
| `forge fix` / `--safe`           | PASS   | visible no-write preview followed by explicit bounded application             |
| `forge verify`                   | PASS   | stale/incomplete evidence remains visible and exits 2                         |
| `forge ship`                     | PASS   | independent fail-closed release gate and smallest next action                 |
| `forge status`                   | PASS   | read-only project, feature, audit, readiness, and next-command view           |
| `forge help`                     | PASS   | simple commands first; expert grammar retained under advanced help            |

Advanced discovery, `new`, feature lifecycle, migration, section audit/fix/verify/report, tools,
rendered UI adapter, installer lifecycle, validation, packaging, and Ship paths remain covered by
the full suite and targeted clean-environment probes.

## Security and backward-compatibility review

- The simple route adds no evidence producer and no route from Build state to a Ship pass.
- Verify demotes positive findings and typed evidence that were not reproduced at the current
  revision; incomplete results use exit 2.
- Install conflict preflight, link refusal, ownership hashes, modified/unowned preservation, atomic
  manifest/file replacement, and interrupted retry were directly exercised.
- Detection never executes hints, and update checking uses a fixed argument vector without a shell.
- Existing reports, Build state, finding identifiers, installer manifests, advanced commands, and
  JSON contracts remain readable and operational.
- Private specifications, local Forge state, credentials, temporary staging, dependency trees, and
  links are excluded from packages and archives.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Remote CI on the pull request and merge commit: PENDING
- Annotated tag `v0.5.0` on the verified commit: PENDING
- Release assets, attestations, downloaded-byte comparison, publication, and immutability
  verification: PENDING
- Clean installation from the future public v0.5.0 tag and release assets: PENDING
- Live discovery and invocation in every supported vendor host UI: PENDING
