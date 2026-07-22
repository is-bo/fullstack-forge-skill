# Release verification — v0.4.0

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

Release recommendation: NO-GO

This tagged-source record covers the local v0.4.0 candidate validated on 2026-07-22. Remote CI,
tagging, publication, provenance, immutability, and post-publication installation cannot be proven
in tagged source and remain pending for the release workflow.

## Environment

| Item               | Value                          |
| ------------------ | ------------------------------ |
| Baseline           | public v0.3.0 `main`           |
| Previous release   | `v0.3.0`                       |
| Integration branch | `codex/v0.4.0-product-layer`   |
| OS                 | Windows 10 Pro 10.0.19045, x64 |
| Node.js            | v24.14.1                       |
| npm                | 11.11.0                        |

## Product evidence

The candidate adds a simple `forge` entrance while preserving the expert CLI, evidence model, 42
Audit modules, Build state, and fail-closed Ship gate. The implementation-to-command mapping and
security invariants are in `PRODUCT_LAYER_DESIGN_v0.4.0.md`; the initial journey gaps and their
disposition are in `PRODUCT_GAP_REPORT_v0.4.0.md`.

## Local validation

All completed rows passed against candidate content. One Windows symlink test is expected to skip
where the host lacks symbolic-link privileges; clean installs separately proved zero reparse points.
The full suite was rerun with a task-owned temporary directory on `D:` after the system temporary
volume produced `ENOSPC`; the storage failure was environmental, not a test failure.

| Command or evidence                              | Result  | Decisive output                                                                         |
| ------------------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| `npm run format:check`                           | PASS    | all candidate files matched Prettier                                                    |
| `npm run lint`                                   | PASS    | zero ESLint errors                                                                      |
| `npm run typecheck`                              | PASS    | TypeScript no-emit check completed                                                      |
| `npm test`                                       | PASS    | 681 tests; 680 passed, 0 failed, 1 expected Windows symlink skip                        |
| `npm run test:evals:v030`                        | PASS    | 44/44 legacy Build and prevention evaluations                                           |
| `npm run test:coverage`                          | PASS    | lines 93.98%, branches 82.78%, functions 93.41%                                         |
| `npm run validate`                               | PASS    | 46 canonical skills validated                                                           |
| `npm run check:platforms`                        | PASS    | 106 generated files synchronized across six roots                                       |
| `npm audit --ignore-scripts`                     | PASS    | zero known vulnerabilities                                                              |
| `npm run scan:secrets`                           | PASS    | 1,322 files scanned with zero findings                                                  |
| `npm run smoke:install`                          | PASS    | packed v0.4.0 lifecycle; 46 skills, zero symlinks                                       |
| `npm run offline:install`                        | PASS    | cache-only install; 46 skills in each root; clean uninstall                             |
| quickstart demo end-to-end test                  | PASS    | Audit → preview → safe fix → Verify; Ship remained honestly blocked                     |
| two consecutive `npm run package:platforms` runs | PASS    | every archive, checksum, and manifest reproduced byte-for-byte                          |
| `npm run validate:dist`                          | PASS    | exact archive set, safe inventory, deterministic metadata                               |
| `npm pack --dry-run --json --ignore-scripts`     | PASS    | declared npm inventory only; demo included; local/private paths excluded                |
| final `npm run check`                            | PASS    | complete fail-closed repository gate passed after the last authored edit                |
| `forge ship --allow-run --json`                  | BLOCKED | all 13 registered commands passed; five application-runtime gates remain `NOT_VERIFIED` |

Archive digests are not embedded here because this document is itself archived. The generated
`dist/SHA256SUMS.txt` and `dist/manifest.json` bind the final candidate bytes; the release workflow
must independently download and compare future published assets.

## Installation and platform matrix

| Boundary                                      | Result         | Evidence or limitation                                                   |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| first-party local npm package                 | PASS           | install, init, doctor, update, dry-run, tamper refusal, uninstall tested |
| first-party cache-only npm install            | PASS           | unreachable registry plus warmed runtime dependency                      |
| third-party `skills` CLI v1.5.20 copy install | PASS           | local candidate copied all 46 skills with no reparse points              |
| release ZIP extraction and validation         | PASS           | six platform archives plus generic bundle validated from local candidate |
| Codex, Claude, Cursor                         | PASS           | generated directory structures and byte synchronization verified         |
| Gemini CLI, Antigravity                       | PASS           | project/global destination structures and install smoke verified         |
| Windsurf, GitHub, generic filesystem          | PASS           | generated structures and archives verified                               |
| live host UI discovery in every agent         | NOT_VERIFIED   | host applications were not launched in this local gate                   |
| public npm registry install                   | NOT_APPLICABLE | the project is distributed from GitHub, not published to npm             |
| GitHub tag/release installation               | PENDING        | requires the immutable remote v0.4.0 tag and release                     |

## Simple-command acceptance matrix

| User command                        | Result | Verified behavior                                                      |
| ----------------------------------- | ------ | ---------------------------------------------------------------------- |
| `forge`                             | PASS   | guided interactive model or deterministic noninteractive menu          |
| `forge build <request>`             | PASS   | redacted stable feature state and collision-safe IDs                   |
| `forge continue`                    | PASS   | single-feature resume; explicit selection/refusal for several features |
| `forge audit [all\|area]`           | PASS   | closed aliases, ambiguity handling, reliable changed-scope fallback    |
| `forge fix [area]`                  | PASS   | visible no-write preview; `--safe` remains explicit write authority    |
| `forge verify [area]`               | PASS   | concise result plus technical and JSON views                           |
| `forge ship`                        | PASS   | existing fail-closed release gate retained                             |
| `forge status`                      | PASS   | read-only feature/report summary                                       |
| `forge help`                        | PASS   | simple-first guidance; expert grammar remains under `help advanced`    |
| `forge doctor`                      | PASS   | runtime, bundle, install, project, state, and freshness diagnostics    |
| `--json`, `--details`, `--no-color` | PASS   | stable machine output, technical detail, and ANSI-free output          |

## Security and compatibility review

- The simple router adds no evidence producer and no alternative route to `PASS`.
- Feature text is redacted before slugging or persistence; path containment, link refusal, ownership
  manifests, hashes, and safe-fix authority remain enforced.
- Repository walks exclude private local `.audit`, `.audit-work`, and `.codex` state before report
  production. Packaging independently rejects local state, private specifications, credentials,
  undeclared paths, and links.
- Existing expert Build, Audit, report, installer, and Ship command contracts remain available.
- No database, hosted frontend, authentication provider, production deployment, or external model
  boundary is introduced by the simple product layer.

## Known local-evidence limits

- TTY choice behavior is verified through the pure menu model and noninteractive CLI end-to-end
  tests; an automated Windows pseudo-terminal session was not available.
- Browser, assistive-technology, provider, deployment, production, and human policy evidence still
  requires the corresponding environment. Missing evidence never becomes `PASS`.
- The third-party skills installer is time-sensitive; v1.5.20 was the version directly inspected and
  tested. The first-party ownership-manifest installer remains authoritative for lifecycle safety.
- The self-Ship inspector cannot yet distinguish Forge's audit-rule implementation from an audited
  application's authentication, tenancy, upload, security, and migration boundaries. It therefore
  keeps five high-risk gates `NOT_VERIFIED` even though every registered release command passes. The
  release remains a no-go; this limitation was not accepted or downgraded.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Remote CI on the pull request and merge commit: PENDING
- Annotated tag `v0.4.0` on the verified commit: PENDING
- Draft release assets, attestations, downloaded-byte comparison, publication, and immutability
  verification: PENDING
- Clean-room installation from the published tag and release assets: PENDING
- Live discovery checks in each supported agent host UI: PENDING
