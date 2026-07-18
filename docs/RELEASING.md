# Releasing

## Local release gate

1. Confirm `0.1.0` (or the intended version) in package, skill, CLI, changelog, and smoke
   assertions.
2. Run `npm run check` on the complete implementation.
3. Run `npm run package:platforms` twice and compare every byte/hash.
4. Run `npm run smoke:install` and inspect `npm pack --dry-run --json --ignore-scripts`.
5. Confirm `npm run validate:dist` verifies entry CRCs, fixed timestamps, licenses, checksums, path
   safety, absence of symlinks, and the exact archive set.
6. Verify the private local specification, research clones, build temporaries, credentials, and
   `node_modules` are ignored, untracked, and absent from all packages.
7. Run `npm run check` again after the final source edit.

## GitHub publication

Commit with clear Conventional Commit subjects, push `main`, and wait for both Linux and Windows CI.
Create annotated tag `v0.1.0` only from the verified commit. The pinned release workflow rebuilds,
validates, smoke-installs, and uploads every ZIP plus `SHA256SUMS.txt` and `manifest.json`.

Release notes must cover purpose, supported agents, installation, commands, evidence and safety
models, distribution files, known limitations, attribution, and social-preview state. Verify the
tag, release page, asset downloads, checksums, and remote commit directly before declaring success.

Do not publish to npm as part of `v0.1.0` unless name availability, authentication, provenance,
package contents, and a separate explicit release decision are all verified. GitHub release failure
must never be hidden by an npm result.

## Clean-room verification

From a newly created temporary directory, install the published repository or release for Claude,
Codex, Antigravity, Gemini, and generic Agent Skills. Confirm expected regular files, no symlinks,
`forge doctor`, skill validation, representative audit/ship behavior, archive installation, README
rendering, and downloadable release assets. Record exact commands and evidence in
`docs/RELEASE_VERIFICATION_v0.1.0.md`.

## Social preview

GitHub does not expose a supported general CLI/API operation for repository social-preview upload.
After publication, a repository administrator must upload
`docs/assets/fullstack-forge-social-preview.png` at:

```text
Repository Settings → General → Social preview → Edit → Upload image
```

Do not claim it is configured until the repository page has been visually checked after that upload.
