# Release verification — v0.5.3

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

Release recommendation: REVIEW, MERGE, AND VERIFY REMOTE CI BEFORE TAGGING OR PUBLISHING

## Scope

- Canonical repository identity: `is-bo/fullstack-forge-skill`
- Previous immutable release: `v0.5.2`
- Candidate branch: `fix/repository-identity-and-packaging`
- Release tag: `v0.5.3` (not created)

## Completed local evidence

| Command or evidence                         | Result | Decisive output                                                                                                                                             |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locked dependency installation              | PASS   | `npm ci --ignore-scripts --no-audit --no-fund` completed.                                                                                                   |
| Generation, formatting, lint, and typecheck | PASS   | All six platform roots synchronized; Prettier, ESLint, and TypeScript completed cleanly.                                                                    |
| Complete test suite                         | PASS   | 726 tests; 725 passed, 0 failed, 1 expected platform skip.                                                                                                  |
| Coverage enforcement                        | PASS   | Lines 94.37%, branches 83.09%, functions 94.09%.                                                                                                            |
| Skill, platform, and branding validation    | PASS   | 46 canonical skills, six platform roots, schemas, metadata, and brand assets validated.                                                                     |
| Repository identity validation              | PASS   | `is-bo/fullstack-forge-skill`; only the reviewed changelog migration reference remains.                                                                     |
| Platform archive validation                 | PASS   | Nine deterministic ZIPs, 1,962 entries, checksums, private-path, traversal, symlink, duplicate, timestamp, old-owner-link, and Markdown-link checks passed. |
| First-party smoke installation              | PASS   | v0.5.3 package, 46 skills, zero symlinks, clean uninstall.                                                                                                  |
| v0.5.2 upgrade and Codex update             | PASS   | Upgrade from public `is-bo` v0.5.2, `update codex`, Doctor, and clean uninstall passed.                                                                     |
| Cache-only offline installation             | PASS   | Six platform roots installed from cache against an unreachable registry; zero symlinks.                                                                     |
| Dependency audit                            | PASS   | Zero known vulnerabilities.                                                                                                                                 |

Candidate Ship is run from a clean committed copy before pull-request handoff. Remote proof remains
separate from this local record.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Windows, Ubuntu, and macOS CI plus CodeQL: PENDING
- Annotated tag `v0.5.3`: PENDING
- Release assets, checksums, attestation, publication, and immutability verification: PENDING
- Clean installation from the public tag and Codex archive: PENDING
