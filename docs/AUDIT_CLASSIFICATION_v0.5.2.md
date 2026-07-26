# Audit classification — v0.5.2

This record classifies the repository-scanning defects addressed by v0.5.2.

| Defect                                                                                       | Status | Evidence                                                          | Remaining limitation                                                                   |
| -------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Generated and binary files consumed the 128 MiB budget before relevance checks               | FIXED  | `cli/src/repository-inventory.ts`, large regression fixtures      | Relevant text remains deliberately bounded.                                            |
| Discovery and capability assessment performed separate walks                                 | FIXED  | `cli/src/discovery.ts`, `cli/src/discovery-evidence.ts`           | Targeted finite package/install walks remain separate callers of the shared primitive. |
| Audit inspectors used inconsistent exclusions and could reproduce the crash after discovery  | FIXED  | `cli/src/inspectors.ts`, `cli/src/analyzers.ts`                   | None known.                                                                            |
| `.gitignore`, `.forgeignore`, and repeatable CLI exclusions were unavailable or inconsistent | FIXED  | Git-aware inventory and CLI regression tests                      | Excluding possible evidence intentionally yields `NOT_VERIFIED`.                       |
| Budget exhaustion aborted without useful evidence                                            | FIXED  | `FF-INVENTORY-001`, Audit/Verify/Ship CLI tests                   | Exit code `2` is expected when required evidence is incomplete.                        |
| Working revision buffered diffs and read every untracked file                                | FIXED  | bounded revision tests with ignored and untracked 140 MiB files   | Skipped dirty state is labeled `dirty-partial`, not fully hashed.                      |
| Agent workflows could begin with a broad scan                                                | FIXED  | canonical `forge`, `forge-all`, `forge-discover`, protocol skills | Agents still need host tools to execute deterministic CLI evidence.                    |

The change is backward-compatible: project-profile schema version 2 and report schema version 2 are
unchanged. The new inventory and report-environment fields are optional for older readers.
