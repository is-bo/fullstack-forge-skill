# Product layer design — v0.5.3

## Identity as a checked invariant

Canonical package metadata, public documentation, CLI update guidance, schemas, generated Agent
Skills, workflows, and release artifacts share `is-bo/fullstack-forge-skill`. The repository check
searches all tracked and relevant untracked files, permits the former username only once in the
reviewed changelog migration note, and rejects any compatibility allowlist entry because no legacy
identifier remains necessary.

## Runtime-looking paths

Runtime names are no longer a global directory exclusion. Git-tracked paths are normal evidence;
nested untracked source is also inspected. A clear top-level local runtime file is skipped without
opening it. When a top-level untracked runtime-looking text/source path cannot be classified safely,
Forge records incomplete evidence rather than reading private content or treating the capability as
absent: inventory is `PARTIAL`, `FF-INVENTORY-001` is `NOT_VERIFIED`, and the process exits `2`.

## Archive integrity

The package allowlist includes the closure of essential user-documentation links. Archive validation
parses each deterministic ZIP in memory, checks checksums, timestamps, duplicate entries, symlinks,
traversal, private paths, old-owner public links, and every packaged relative Markdown destination.
