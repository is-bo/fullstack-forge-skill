# Release verification — v0.3.0

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This tagged-source record covers the complete local candidate as validated on 2026-07-22. Remote CI,
publication, provenance, immutability, and post-publication installation cannot be proven in tagged
source and remain pending for the release workflow.

## Baseline and environment

| Item               | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Baseline           | public v0.2.0 `main` before the v0.3 integration branch |
| Previous release   | `v0.2.0`                                                |
| Integration branch | `codex/v0.3.0-build-mode-evidence`                      |
| OS                 | Windows 10 Pro 10.0.19045, x64                          |
| Node.js            | v24.14.1                                                |
| npm                | 11.11.0                                                 |

## Candidate implementation evidence

The release branch contains domain-separated evidence envelopes, exact Build producers,
applicability and tier gates, schema-v2 project/feature state, full runtime and design evidence,
journaled migration, Ship stable-revision re-derivation, and both public v0.3 evaluation corpora.
The detailed defect-to-evidence classification is in `AUDIT_CLASSIFICATION_v0.3.0.md`.

## Local validation

All rows passed against the final candidate content. A single expected Windows symlink test was
skipped because the host does not grant symbolic-link creation; the exercised code path remains
covered on capable hosts and by remote CI.

| Command or evidence                                     | Result | Decisive output                                                                |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `npm run format:check`                                  | PASS   | all tracked files matched Prettier                                             |
| `npm run lint`                                          | PASS   | zero ESLint errors                                                             |
| `npm run typecheck`                                     | PASS   | TypeScript no-emit check completed                                             |
| `npm test`                                              | PASS   | 662 tests; 661 passed, 0 failed, 1 skipped                                     |
| `npm run test:evals:v030`                               | PASS   | 44 assertions across the two exact twelve-case public corpora                  |
| `npm run test:coverage`                                 | PASS   | lines 93.70%, branches 83.73%, functions 93.46%                                |
| `npm run validate`                                      | PASS   | 45 canonical skills and six generated platform roots                           |
| `npm run check:platforms`                               | PASS   | 105 generated files exactly synchronized to all six roots                      |
| `npm run check:links`                                   | PASS   | 764 Markdown files and 149 checked references                                  |
| `npm run check:licenses` / `npm audit --ignore-scripts` | PASS   | 91 dependencies on allowed licenses; zero known vulnerabilities                |
| `npm run check:fixtures` / `npm run check:workflows`    | PASS   | 12 non-installable fixtures; three workflows satisfy immutable-action policy   |
| `npm run check:release-docs`                            | PASS   | tagged source records local PASS and leaves remote publication PENDING         |
| `npm run check:install-docs`                            | PASS   | 62 installation/version references inspected                                   |
| `npm run check:traceability`                            | PASS   | 81 requirements: 43 compliant, 36 partial, 2 explicitly not verified           |
| `npm run check:branding` / `npm run scan:secrets`       | PASS   | three brand assets valid; 1,286 files scanned with zero findings               |
| two consecutive `npm run package:platforms` runs        | PASS   | nine archives, 1,722 entries; every output reproduced byte-for-byte            |
| `npm run validate:dist`                                 | PASS   | exact archive/checksum/manifest set, deterministic metadata, no unsafe entries |
| `npm run smoke:install`                                 | PASS   | packed v0.3.0 install, CLI/generation/update/uninstall, zero symlinks          |
| `npm run offline:install`                               | PASS   | cache-only install with unreachable registry; 45 skills in each platform root  |
| `npm pack --dry-run --json --ignore-scripts`            | PASS   | 983 files; zero private, credential, local-state, or temporary paths           |
| `npm run check` after the final source edit             | PASS   | complete fail-closed project check passed without changing generated output    |

The literal archive digests are intentionally not embedded in this source file because this file is
itself present in every archive. `SHA256SUMS.txt` and `manifest.json` are generated from the final
tagged bytes, and the workflow-generated post-tag verification asset records their exact digests
after downloading and comparing the draft assets byte-for-byte.

## Single-maintainer pre-release review

No independent reviewer or subagent was used. The integrating maintainer performed a direct review
of the completed candidate and its adverse tests:

- Evidence and security: producer/domain separation, envelope shape and re-hashing, root/revision/
  expiry binding, command/runtime redaction, risk-acceptance policy binding, secret scanning, and
  denial of planted or stale positive claims.
- State and recovery: strict schema keys, canonical feature enumeration, path/symlink containment,
  atomic writes, exact migration journals, byte backups, interruption resume, rollback, and tamper
  refusal.
- Architecture, API, data, and authorization boundaries: CLI dispatch and compatibility, offline/
  allow-run authority, current applicability/gate derivation, stable-revision Ship inspection, and
  categorical exclusion of Build evidence from Audit/Ship gates.
- Frontend, UI, UX, and accessibility contracts: the finite eight-state by three-viewport runtime
  matrix, screenshot/keyboard/accessibility/overflow/console observations, artifact binding, and
  fail-closed behavior when browser or human evidence is unavailable. This release adds no hosted
  application UI of its own.
- Reliability, performance, and observability: bounded subprocesses, stable-revision retries,
  deterministic generation/package output, Windows transient-write limits, explicit limitations, and
  visible blocked/not-verified outcomes.
- Tests, evaluations, docs, compatibility, and package hygiene: the full suite and coverage, both
  exact public corpora, Audit command compatibility, public claim alignment, npm/ZIP inventory,
  clean installs, licensing, and exclusion of private/local material.

The review found and fixed two final candidate defects before this record: completion now requires a
risk acceptance whose category, policy, and accountable actor match the strongest current gate; and
ordinary Build loads now use the same exact migration-journal validator as resume/rollback.

## Private and local material

Private specifications, local audit state, research temporaries, credentials, logs, release staging,
coverage output, and task-owned temporary directories are excluded from version control, npm
inventory, and ZIP allowlists. Staged files, npm inventory, ZIP inventory, and secret-scan output
were inspected directly.

## Known local-evidence limits

- The evidence envelope proves local provenance, integrity, freshness, and contract matching; it is
  not an externally signed attestation and does not defend against a hostile same-user actor able to
  replace both executable code and state.
- Browser, assistive-technology, provider, production, and human design/policy evidence still
  requires the corresponding environment or reviewer. Missing evidence never becomes `PASS`.
- Bounded analyzers and registered producers document unsupported shapes and do not claim
  whole-program, provider, production, or compliance proof.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Remote CI on the merge commit (Linux, Windows, macOS, dependency review, CodeQL): PENDING
- Annotated tag `v0.3.0` on the verified commit: PENDING
- Release workflow draft, attestations, downloaded-byte comparison, one-way publication, and
  immutability verification: PENDING
- Clean-room installation from the published tag and release assets: PENDING
- GitHub repository description/topics/social-preview visual check: PENDING
