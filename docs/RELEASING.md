# Releasing

## Local release gate

1. Confirm the intended version in package, lockfile, skill, CLI, changelog, release notes, and
   smoke assertions.
2. Run the complete required command matrix in `AGENTS.md`, including `npm ci --ignore-scripts`, the
   component checks, `npm run check`, packaging, distribution validation, smoke installation, and
   `npm audit`.
3. Run `npm run test:evals:v030` and inspect the exact prevention/module outcomes. A missing
   runtime, provider, external tool, or human judgment must remain `BLOCKED`/`NOT_VERIFIED`.
4. Run `npm run package:platforms` twice and compare every byte/hash.
5. Run `npm run smoke:install` and inspect `npm pack --dry-run --json --ignore-scripts`.
6. Run `npm run smoke:upgrade` to install the previous public tag, initialize all generated roots,
   install the candidate artifact, update ownership-aware files, run Doctor, and uninstall cleanly.
7. Confirm `npm run validate:dist` verifies entry CRCs, fixed timestamps, licenses, checksums, path
   safety, absence of symlinks, and the exact archive set.
8. Verify the private local specification, research clones, build temporaries, credentials, and
   `node_modules` are ignored, untracked, and absent from all packages.
9. Run `npm run check:release-docs`; the tagged record must say `TAGGED_LOCAL`, record local
   validation as `PASS`, and keep remote publication `PENDING`.
10. Run `npm run check` again after the final source edit.

## GitHub publication

Commit with clear Conventional Commit subjects, merge through a reviewed pull request, and wait for
Linux, Windows, macOS, dependency-review, and CodeQL results. Release notes and a tagged local
record must exist at `docs/RELEASE_NOTES_<tag>.md` and `docs/RELEASE_VERIFICATION_<tag>.md` before
tagging. Create an annotated release tag only from the verified commit. Never move or recreate a
public tag. The pinned release workflow proves that the tag resolves to the expected commit and that
no release exists, rebuilds and validates, creates a draft without clobbering, attests every ZIP,
downloads and compares the draft assets byte-for-byte, adds checksummed final evidence, publishes
exactly once, and verifies the immutable release and asset attestations.

Release notes must cover purpose, supported agents, installation, commands, evidence and safety
models, distribution files, known limitations, attribution, and social-preview state. Tagged source
must not claim remote CI, publication, provenance, or immutability already passed. The tag workflow
publishes `FINAL_RELEASE_VERIFICATION_<tag>.md` and its checksum as release assets after draft-asset
verification; that asset explicitly states that it was not present in tagged source. Verify the tag,
release page, asset downloads, checksums, provenance, immutability, and remote commit directly
before declaring success.

Do not publish to npm unless name availability, authentication, provenance, package contents, and a
separate explicit release decision are all verified. GitHub release failure must never be hidden by
an npm result.

## Clean-room verification

From a newly created temporary directory, install the published repository or release for Claude,
Codex, Antigravity project and user scope, Gemini project and user scope, and generic Agent Skills.
Confirm expected regular files, no symlinks or reparse points, `forge doctor`, skill validation,
safe/risky fix behavior, changed-scope and representative specialist/full audits, ship behavior,
archive installation and checksums, README rendering, and downloadable release assets. Record exact
commands, exit codes, versions, commit, CI URLs, release URL, and limitations in the
release-specific verification document.

## Social preview

GitHub does not expose a supported general CLI/API operation for repository social-preview upload.
After publication, a repository administrator must upload
`docs/assets/fullstack-forge-social-preview.png` at:

```text
Repository Settings → General → Social preview → Edit → Upload image
```

Do not claim it is configured until the repository page has been visually checked after that upload.
