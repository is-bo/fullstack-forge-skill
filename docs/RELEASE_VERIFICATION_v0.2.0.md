# Release verification — v0.2.0

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This is the tagged-source record. It contains complete local evidence gathered before the tag was
created, while remote CI, publication, provenance, and immutable-release checks remain explicitly
pending. The tag workflow generates a separate final evidence asset after draft assets have been
downloaded and verified; that final asset is not content of the original tag.

## Baseline and environment

| Item                   | Value                          |
| ---------------------- | ------------------------------ |
| Baseline `origin/main` | `7303fcf` (merge of PR #30)    |
| Previous release       | `v0.1.10`                      |
| Integration branch     | `integrate/v0.2.0`             |
| OS                     | Windows 10 Pro 10.0.19045, x64 |
| Node.js                | v24.x (see CI for exact patch) |

## Integration record

Build mode was implemented as bounded workstreams on isolated worktree branches with non-overlapping
file ownership — CLI core (state machine, schemas, tests), generation pipeline and command skills,
42 build-guidance briefs, prevention evaluations, and documentation — each reviewed by the
integrating maintainer before merge in dependency order. The baseline v0.1.10 audit product was
inspected against its original specification before the milestone began; no FAIL-classified
requirement was found, and the one public-claim defect (stale install pins) was fixed first.

## Independent pre-release reviews

Two independent reviews ran against the completed integration branch before this record was written:
a security/evidence-integrity review and a public-claims/compatibility review. Both returned
approve-with-conditions. Every reported defect was reproduced, classified, and resolved before the
version bump; see `docs/AUDIT_CLASSIFICATION_v0.2.0.md` for the complete table. The review's
decisive integrity check — that build state satisfies zero ship gates — was confirmed by code
inspection of `gates.ts` (no build-state reference) and by the byte-identical before/after
ship-status assertion in `cli/tests/build-ship-isolation.test.ts`.

## Local validation

The complete `npm run check` chain passed at the release-candidate revision: format, lint,
typecheck, build, the full test suite (542 tests, 0 failures, including 62 build-mode tests and 26
prevention-eval assertions), skill validation (45 canonical skills), platform synchronization (6
roots, byte-identical), link, license, fixture, workflow, release-doc, install-doc, traceability,
and branding checks, and the secret scan (0 findings). `npm run package:platforms` was run twice
with byte-identical archive hashes, `npm run validate:dist` verified entry CRCs, fixed timestamps,
licenses, checksums, path safety, absence of symlinks, and the exact archive set, and
`npm run smoke:install` performed clean-room installations from the packaged archives.
`npm audit --ignore-scripts` reported the dependency state recorded in the CI logs.

## Combined-product verification

Both modes were exercised end to end against the compiled CLI in temporary projects outside the
repository: `forge new` foundation artifacts; the light-tier two-invocation flow; tier-floor
escalation with recorded triggers and reasoned override; resume and stale-evidence demotion;
`accept-risk` refusal for high-tier security controls; `done` refusal with an actionable missing
list; the dev-to-audit transition (`forge all audit` on a build-mode project); ship independence
(`forge ship` failing closed despite a completed build feature); and audit mode on a deliberately
vulnerable fixture (12 FAIL findings on `fixtures/insecure-api`).

## Private specification

The private local specification inputs remained untracked and excluded throughout the milestone
(`.git/info/exclude`), were moved outside the working tree, and are absent from every commit,
archive, and generated platform package. The secret scan and packaging validation cover the tree
that ships.

## Pending remote steps

- Remote CI (Linux, Windows, macOS, dependency review, CodeQL) on the merge commit: PENDING
- Pull-request review and merge to `main`: PENDING
- Annotated tag `v0.2.0` on the verified merge commit: PENDING
- Release workflow: draft creation, asset attestation, byte-for-byte draft verification,
  publication, and immutability check: PENDING
- Post-release clean-room installation from the published release: PENDING
- Social-preview upload (manual, documented in `docs/RELEASING.md`): PENDING
