# Migrating to Fullstack Forge v0.3.1

v0.3.1 carries the v0.3.0 feature set forward under a fresh immutable release identity. It keeps the
evidence-gated orchestration, portable agent-host adapters, Codex plugin packaging, and exact
release-artifact installation path.

Upgrade from the exact release package:

```bash
npm install --save-dev "https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.1/fullstack-forge-skill-v0.3.1.tgz"
# NOT YET AVAILABLE until the v0.3.1 GitHub Release is published.
npx --no-install forge update all
npx --no-install forge doctor
```

Existing v0.2.2 or v0.3.0 project installations remain ownership-managed. Run `forge update all`
after the package upgrade so every detected host receives the current adapters and canonical
runtime. User files and modified Forge-owned sections remain protected by the existing conflict
rules.

The repository marketplace entry is pinned to `fullstack-forge-skill@0.3.1` and remains
`NOT_AVAILABLE` because the npm package is not published by the GitHub Release workflow. Use the
exact GitHub Release package for project-local installation.

Historical tags, including v0.3.0, must not be moved, rewritten, or republished.
