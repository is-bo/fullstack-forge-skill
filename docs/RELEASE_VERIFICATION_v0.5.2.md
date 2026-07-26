# Release verification — v0.5.2

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

Release recommendation: RUN FINAL CHECK AND SHIP, THEN REVIEW, MERGE, AND VERIFY REMOTE CI

## Environment

| Item               | Value                               |
| ------------------ | ----------------------------------- |
| Baseline           | public v0.5.1 `main`                |
| Previous release   | `v0.5.1`                            |
| Integration branch | `codex/v0.5.2-repository-inventory` |
| OS                 | Windows 10 Pro 10.0.19045, x64      |
| Node.js            | v24.14.1                            |
| npm                | 11.11.0                             |

## Completed local evidence

| Command or evidence                  | Result | Decisive output                                                                              |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| retained 135 MiB reproduction        | PASS   | complete JSON profile; 118 relevant bytes read; no scanner stderr                            |
| focused scanner/discovery batch      | PASS   | 50 passed, 0 failed                                                                          |
| complete coverage corpus             | PASS   | 716 tests; 715 passed, 0 failed, 1 expected platform skip                                    |
| coverage thresholds                  | PASS   | lines 94.39%, branches 83.42%, functions 94.05%                                              |
| platform package validation          | PASS   | 9 archives; 1,890 entries; path, link, private-state, manifest, and checksum policies passed |
| deterministic platform package build | PASS   | repeated archives, manifest, and `SHA256SUMS.txt` were byte-identical                        |
| first-party smoke installation       | PASS   | v0.5.2 CLI; 46 skills; zero symlinks; clean uninstall                                        |
| v0.5.1-to-v0.5.2 upgrade             | PASS   | 46 skills/root; Doctor ready; zero symlinks; clean uninstall                                 |
| cache-only offline installation      | PASS   | six roots × 46 skills; unreachable generation registry; clean uninstall                      |
| dependency audit                     | PASS   | zero known vulnerabilities                                                                   |

## Compatibility and safety

Schema-v2 profile and report versions remain unchanged; inventory fields are additive and optional.
Build evidence still satisfies no Audit or Ship gate. Missing, excluded, skipped, or exhausted
required evidence remains `NOT_VERIFIED`.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Windows, Ubuntu, and macOS CI plus CodeQL: PENDING
- Annotated tag `v0.5.2`: PENDING
- Release assets, checksums, attestation, publication, and immutability verification: PENDING
- Clean installation from the public tag and Codex archive: PENDING
