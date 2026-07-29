# Migrating to Fullstack Forge v0.2.1

v0.2.1 corrects the upstream-powered architecture without changing the 42 public Forge module names.
The release is not installable by tag until its GitHub Release is published.

After publication, upgrade with:

```bash
npm install --save-dev "https://codeload.github.com/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v0.2.1"
npx forge update
npx forge doctor
```

Bare `forge update` now touches only hosts recorded in the installation manifest. Use an explicit
selector or `all` to expand that scope. Unchanged obsolete Forge-owned files are retired; modified
files are preserved and reported.

Module commands now run deterministic composition and write `.forge/composition.json` plus a schema
3 report composition ledger. `--request <provider-or-technology>` is repeatable and outranks
ordinary evidence when a context budget is saturated. Missing selected content is reported as
`NOT_VERIFIED`.

`forge doctor` no longer performs a remote release lookup by default. Add `--check-updates` when you
want to authorize it. The installed `.forge/` evidence directory is user/project state and is
intentionally preserved by uninstall.

`v0.2.0` remains an immutable historical tag. Do not move it or retry publication under that
version.
