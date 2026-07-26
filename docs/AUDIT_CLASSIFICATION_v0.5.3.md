# Audit classification — v0.5.3

This record classifies the release-quality defects addressed by v0.5.3.

| Defect                                                                            | Status | Evidence                                                                     | Compatibility impact                                                                      |
| --------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Public repository identity referenced the former GitHub username                  | FIXED  | Canonical metadata, documentation, workflow, CLI, and generated-asset checks | Existing installed state and tags remain valid.                                           |
| Tracked source beneath runtime-looking directory names could be silently excluded | FIXED  | Git and fallback inventory regression coverage                               | Tracked source is now inspected; ambiguous untracked top-level runtime text fails closed. |
| ZIP archives omitted documents targeted by packaged Markdown                      | FIXED  | Archive allowlist closure and in-memory archive link validation              | Essential user documentation is included in every archive.                                |
| Identity or archive policy could regress without a dedicated gate                 | FIXED  | `check:repository-identity` and `check:archives`                             | The full repository check now fails on either regression.                                 |

Schema `$id` values moved to the canonical repository because the implementation loads local schema
files and uses only fragment `$ref` values. No persisted report or external resolver compares these
URLs, so no legacy identifier is retained.
