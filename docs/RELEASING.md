# Releasing

## Local release gate

1. Confirm the intended version in package, lockfile, skill, CLI, changelog, release notes, and
   smoke assertions.
2. Run the complete required command matrix in `AGENTS.md`, including `npm ci --ignore-scripts`, the
   component checks, `npm run check`, packaging, distribution validation, smoke installation, and
   `npm audit`.
3. Run `npm run package:platforms` twice and compare every byte/hash.
4. Run `npm run smoke:install` and inspect `npm pack --dry-run --json --ignore-scripts`.
5. Confirm `npm run validate:dist` verifies entry CRCs, fixed timestamps, licenses, checksums, path
   safety, absence of symlinks, and the exact archive set.
6. Verify the private local specification, research clones, build temporaries, credentials, and
   `node_modules` are ignored, untracked, and absent from all packages.
7. Run `npm run check` again after the final source edit.

## GitHub publication

Commit with clear Conventional Commit subjects, push `main`, and wait for both Linux and Windows CI.
Create an annotated release tag only from the verified commit. Never move or recreate a public tag.
The pinned release workflow rebuilds, validates, smoke-installs, and uploads every ZIP plus
`SHA256SUMS.txt` and `manifest.json`.

Release notes must cover purpose, supported agents, installation, commands, evidence and safety
models, distribution files, known limitations, attribution, and social-preview state. Verify the
tag, release page, asset downloads, checksums, and remote commit directly before declaring success.

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
