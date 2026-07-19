# Release verification — v0.1.4

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This is the tagged-source record. It will contain complete local evidence before the tag is created,
while remote CI, publication, provenance, and immutable-release checks remain explicitly pending.
The tag workflow generates a separate final evidence asset after draft assets have been downloaded
and verified; that final asset is not content of the original tag.

## Baseline and environment

| Item                            | Value                                                 |
| ------------------------------- | ----------------------------------------------------- |
| Baseline `origin/main`          | `43fd16872b95f9a11eb7a07bab87aa19060a59d2`            |
| Previous release implementation | `0aab8ec1c1b4e55fb1455120d980367ef96c89cd` (`v0.1.3`) |
| Corrective branch               | `fix/v0.1.4-security-correctness`                     |
| OS                              | Windows 10 Pro 10.0.19045, x64                        |
| Node.js                         | v24.14.1                                              |
| npm                             | 11.11.0                                               |
| TypeScript                      | 6.0.3                                                 |

## Untouched baseline

The untouched `43fd1687` checkout passed formatting, lint, type checking, 164/164 tests, validation,
platform synchronization, 401 documentation links plus 126 skill-reference links, license checks for
91 dependency packages, branding, secret scanning, and `npm audit --ignore-scripts` with zero known
vulnerabilities. Baseline coverage was 90.26% lines, 81.57% branches, and 90.30% functions; coverage
was reported but not enforced.

## Final local validation

Every command below ran from the corrective worktree on Node.js 24.14.1. Nonzero Forge exits in the
purpose-built cases are asserted fail-closed results, not ignored command failures.

| Command / check                  | Result | Evidence                                                                                  |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts`        | PASS   | 91 packages installed; 92 audited; zero vulnerabilities                                   |
| `npm run format:check`           | PASS   | every included file matches Prettier                                                      |
| `npm run lint`                   | PASS   | zero ESLint errors or warnings                                                            |
| `npm run typecheck`              | PASS   | TypeScript 6.0.3, no emit                                                                 |
| `npm test`                       | PASS   | 219/219 tests; zero skipped, cancelled, or todo                                           |
| `npm run test:coverage`          | PASS   | 219/219 tests and every overall/focused threshold enforced                                |
| `npm run validate`               | PASS   | 43 canonical skills, six generated platform roots, schemas, and metadata                  |
| `npm run check:platforms`        | PASS   | six roots match 57 canonical files and ownership manifests                                |
| `npm run check:links`            | PASS   | 406 Markdown files and 130 references                                                     |
| `npm run check:licenses`         | PASS   | 91 dependency packages use allowed licenses                                               |
| `npm run check:fixtures`         | PASS   | 12 sentinel manifests; zero installable fixture roots or locks                            |
| `npm run check:workflows`        | PASS   | three workflows pass immutable-pin and release-safety policy                              |
| `npm run check:release-docs`     | PASS   | tagged local PASS plus remote PENDING contract                                            |
| `npm run check:branding`         | PASS   | all three required image assets validated                                                 |
| `npm run scan:secrets`           | PASS   | 702 tracked/untracked existing files scanned; zero findings                               |
| `npm run check`                  | PASS   | final aggregate repository gate                                                           |
| `npm run package:platforms`      | PASS   | nine deterministic ZIPs; 1,050 validated archive entries                                  |
| `npm run validate:dist`          | PASS   | version, manifest, checksum, path, entry, and archive policies                            |
| `npm run smoke:install`          | PASS   | clean packed install, project/global layouts, uninstall records, zero symlinks            |
| `npm run offline:install`        | PASS   | cache-only npm install with unreachable registry; 43 skills in each of six platform roots |
| `npm audit --ignore-scripts`     | PASS   | zero known vulnerabilities                                                                |
| `npm pack --dry-run --json`      | PASS   | 543 files; no private specification, live fixture manifests, or credential files          |
| publishable reparse-point scan   | PASS   | zero symlinks or Windows reparse points                                                   |
| two independent package rebuilds | PASS   | identical names, byte lengths, and SHA-256 values                                         |

### Coverage

| Metric    | Measured | Enforced overall floor |
| --------- | -------: | ---------------------: |
| Lines     |   91.34% |                    88% |
| Branches  |   82.44% |                    76% |
| Functions |   92.05% |                    87% |

Focused floors also passed for data flow, analyzers, finding identity, fixes, verification, gates,
scope, discovery, installation, fixture-manifest validation, filesystem safety, deterministic ZIPs,
and release/workflow safety. The selected Node reporter does not expose statements separately, so
that metric remains explicitly unmeasured. Coverage is supporting evidence, not security proof.

### Direct CLI and gate evidence

- A purpose-built TypeScript project produced six SQL, one shell, three SSRF, and three validation
  findings while leaving parameter binding, fixed executable/validated argument arrays, an
  allowlisted non-redirecting destination, and a shadowed server-owned binding unreported. Its
  authorization audit produced six structurally connected vulnerable instances; owner predicates and
  a dominating subject/object guard remained clean.
- `forge all audit` on that project returned exit 1 with 40 findings and structured analyzer
  coverage. The FastAPI, Django, Go, Rust, JVM, mixed-language, unknown-Python, and partial-JS paths
  are additionally covered by end-to-end CLI tests.
- On the safe-fix project, plan-only fix returned exit 2 / `BLOCKED`, three proposed operations, and
  zero byte changes; `--safe --dry-run` returned three operations and zero writes; `--safe` changed
  exactly `.env.example`, `Link.tsx`, and `vercel.json`. Verification returned exit 0 with all three
  actions tied to their exact `instance_id`.
- Changed-scope audit selected only the unstaged `app.ts` relative to `HEAD`, retained the
  merge-base evidence, and detected the introduced SQL and validation instances without selecting
  `unrelated.ts`.
- Ordinary-application ship evaluation returned exit 1: all seven Forge-only gates were
  `NOT_APPLICABLE`, secret evidence passed only the secret gate, dependency and license evidence
  remained `NOT_VERIFIED`, and the real security gate failed.
- Forge self-audit returned exit 1 with six high findings, all in deliberately vulnerable analyzer
  snippets under `cli/tests`. Self ship therefore left all seven command-backed release gates
  `BLOCKED` behind the failed open-finding gate instead of claiming they passed. The same underlying
  release commands are independently green above; test-file/runtime distinction remains a stated
  analyzer limitation.

### Local artifacts and clean installation

Two complete `package:platforms` runs produced identical bytes. The final `SHA256SUMS.txt` and
`manifest.json` are generated alongside nine v0.1.4 archives; embedding their digests here would be
self-referential because this tagged record is itself packaged. Distribution validation inspected
1,050 entries and rejected traversal, duplicate paths, unsupported types, symlinks, and missing
required evidence documents.

The npm pack dry run included 543 files and excluded `FULLSTACK_FORGE_SPEC.md`, active fixture
manifests, lockfiles, environment credentials, and local audit data. Smoke installation exercised
the packed tarball and uninstall metadata. Offline installation used a deliberately unreachable
registry, installed 43 skills to every supported platform root, found zero symlinks, and uninstalled
cleanly.

## Remote work pending after tag creation

- [ ] Pull-request CI on Linux, Windows, and macOS.
- [ ] Dependency review and CodeQL analysis.
- [ ] Merge and successful `main` CI.
- [ ] Annotated tag resolution to the final main commit.
- [ ] Tag-triggered release checks and coverage.
- [ ] Draft asset creation without replacement or duplicate names.
- [ ] Archive and final-evidence provenance attestations.
- [ ] Published checksum and byte-for-byte asset verification.
- [ ] Clean-room installation from the tag and a published archive.
- [ ] One-way publication and direct immutable-release verification.
- [ ] Final post-tag evidence asset and checksum visible on the release page.

Missing remote evidence is not a pass. The authoritative remote result will be the linked workflow,
release, attestations, downloaded assets, and post-tag final evidence asset.
