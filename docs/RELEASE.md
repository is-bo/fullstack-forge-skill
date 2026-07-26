# Release process

`v0.1.0` is the first intentionally supported public release of the agent-first product. Earlier
numbered snapshots were rapid development previews. Do not rewrite Git history or claim they never
existed.

## Candidate gate

1. Confirm `0.1.0` in package, lockfile, skill metadata, CLI constant, changelog, docs, archive
   names, and tests.
2. Run focused automatic-activation, managed-instruction, proportional-workflow, finding-ingestion,
   report-consistency, generation, version, packaging, and installation tests.
3. Run the complete matrix in `AGENTS.md`, followed by `npx forge ship --allow-run --json` on a
   clean candidate.
4. Package twice and compare archive/checksum bytes. Inspect npm pack contents and verify fresh,
   update, uninstall, and offline installation.
5. Wait for Windows, Ubuntu, macOS, dependency-review, and CodeQL results. Local checks do not prove
   remote CI.

## Preview cleanup and publication

Only after every candidate gate passes:

1. Inventory GitHub Releases and tags and search docs/packages for dependencies on them.
2. Stop if any preview tag is required externally or for reproducibility.
3. Delete preview Release entries, then preview tags, using explicit names—never wildcards.
4. Create annotated `v0.1.0` on the final validated release commit.
5. Publish **Fullstack Forge v0.1.0 — First supported agent-first release** with verified archives,
   checksums, attestations, and notes that earlier numbers were unsupported development snapshots.
6. Download and verify published assets before reporting success.

Never publish after a failed or missing local/remote gate. Remote release deletion is irreversible
enough to require a direct inventory and dependency check immediately before execution.
