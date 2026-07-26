# Release notes — v0.5.3

## Fixed

- Completed the repository migration to `is-bo/fullstack-forge-skill`.
- Prevented tracked application source under runtime-looking directory names from being silently
  excluded.
- Included all referenced user documentation in release archives.
- Added archive-level Markdown link validation.
- Added repository-identity regression checks.

## Compatibility

- Existing Forge state remains supported.
- Previous release tags remain unchanged.

## Install or update

After the immutable v0.5.3 tag exists:

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.5.3"
npx forge update codex
npx forge doctor
```

Confirm the installed source with:

```bash
npm pkg get devDependencies.fullstack-forge-skill
```

Remote CI, CodeQL, tagging, publication, provenance, immutability, and post-publication installation
remain pending until their authorized workflows run.
