# Migrating to Fullstack Forge v0.2.2

v0.2.2 contains the complete v0.2.1 correction scope plus a release-preflight correction. The public
`v0.2.1` tag is retained as an immutable partial-release record and has no GitHub Release.

After v0.2.2 is published, upgrade with:

```bash
npm install --save-dev "https://codeload.github.com/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v0.2.2"
npx forge update
npx forge doctor
```

The behavioral migration is unchanged from v0.2.1: deterministic composition runs in production,
bare update and uninstall affect only installed hosts, stale modified content is preserved without
retaining obsolete ownership, and doctor performs remote update checks only with `--check-updates`.

`v0.2.0` and `v0.2.1` remain immutable historical tags. Do not move them or retry publication under
either version.
