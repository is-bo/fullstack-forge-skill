# Release verification — v0.5.1

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

Release recommendation: GO FOR FINAL CLEAN SHIP GATE, REVIEW, MERGE, AND REMOTE CI

This source record covers the locally validated v0.5.1 candidate. Remote CI, tagging, publication,
provenance, immutability, post-publication installation, and live Codex picker rendering remain
pending.

## Environment

| Item               | Value                           |
| ------------------ | ------------------------------- |
| Baseline           | public v0.5.0 `main`            |
| Previous release   | `v0.5.0`                        |
| Integration branch | `codex/v0.5.1-codex-onboarding` |
| OS                 | Windows 10 Pro 10.0.19045, x64  |
| Node.js            | v24.14.1                        |
| npm                | 11.11.0                         |

## Completed local evidence

| Command or evidence                   | Result | Decisive output                                                         |
| ------------------------------------- | ------ | ----------------------------------------------------------------------- |
| focused onboarding and routing tests  | PASS   | 24 passed, 0 failed                                                     |
| `npm test`                            | PASS   | 706 tests; 705 passed, 0 failed, 1 expected Windows symlink skip        |
| `npm run test:coverage`               | PASS   | lines 94.09%, branches 82.99%, functions 93.80%                         |
| canonical and generated validation    | PASS   | 46 skills; 108 files synchronized across six roots                      |
| format, lint, typecheck, and branding | PASS   | formatting clean; zero lint/type errors; brand image dimensions valid   |
| dependency audit                      | PASS   | zero known vulnerabilities                                              |
| deterministic package build           | PASS   | two runs matched; nine archives, 1,890 entries, checksums, and manifest |
| first-party smoke installation        | PASS   | 46 skills, Doctor/update/uninstall lifecycle, zero symlinks             |
| cache-only offline installation       | PASS   | six roots × 46 skills, unreachable generation registry, clean uninstall |
| public v0.5.0-to-candidate upgrade    | PASS   | metadata added, Doctor ready, 46 skills/root, clean uninstall           |
| independent clean `forge ship` gate   | PASS   | exit 0 on staged commit `0b3deeae5e269546fe426b86c8d89be1e00cc94c`      |

The independent Ship run passed with release-readiness finding `FF-SHIP-001` at `PASS`; its project
tests, package validation, smoke installation, secret scan, dependency audit, and license scan all
exited successfully. One final clean Ship run must now verify this updated record before tagging.

## Compatibility and safety

All expert skill names, schemas, findings, evidence producers, approval boundaries, installer
selectors, and JSON contracts remain available. No-action rendering is read-only. Build evidence
still satisfies no Audit or Ship gate, and missing evidence remains fail-closed.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Remote CI and CodeQL on the pull request and merge commit: PENDING
- Annotated tag `v0.5.1` on the verified commit: PENDING
- Release assets, checksums, attestations, publication, and immutability verification: PENDING
- Clean installation from the future public v0.5.1 tag and Codex archive: PENDING
- Restarted Codex picker rendering confirmation: PENDING
