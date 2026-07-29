# Release process

`v0.2.1` is the release candidate for the first published upstream-powered release. It is not a
supported public release until the GitHub Release exists and its downloaded assets have been
verified. `v0.2.0` is a tagged but unpublished historical state; do not move, delete, rewrite, or
retry publication under that tag. npm publication remains unconfigured.

## Candidate gate

1. Confirm `0.2.1` in package, lockfile, skill metadata, CLI constant, changelog, docs, archive
   names, and tests.
2. Run focused composition, managed-instruction, proportional-workflow, finding-ingestion,
   report-consistency, generation, version, packaging, installation, upgrade, and retry tests.
3. Run the complete matrix in `AGENTS.md`, followed by `npx forge ship --allow-run --json` on a
   clean candidate.
4. Package twice and compare archive/checksum bytes. Inspect npm pack contents and verify fresh,
   update, uninstall, clean-room, and offline installation.
5. Wait for Windows, Ubuntu, macOS, dependency-review, and CodeQL results. Local checks do not prove
   remote CI.

## Publication

Only after every candidate gate passes:

1. Inventory all GitHub Releases, including drafts, tags, assets, and attestations. As of the
   candidate audit, no v0.2.0 draft remains; do not infer that this is still true at publication
   time.
2. Preserve the v0.2.0 tag unchanged. Never retry publication under it or recreate its former draft.
3. Require preflight to fail closed if any release, draft, duplicate asset, or candidate attestation
   already exists for v0.2.1. Investigate a partial run instead of replacing it.
4. Create annotated `v0.2.1` on the exact verified main merge commit.
5. Publish **Fullstack Forge v0.2.1** with verified archives, checksums, attestations, and truthful
   notes that v0.2.0 remains a tagged but unpublished historical state.
6. Download and verify published assets before reporting success.
7. The README's conditional installation guidance calls v0.2.1 current only when that immutable
   release can actually be observed.

Never publish after a failed or missing local or remote gate. Never report a remote result that was
not directly observed.
