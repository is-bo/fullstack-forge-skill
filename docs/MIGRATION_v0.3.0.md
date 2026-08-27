# Migrating to Fullstack Forge v0.3.0

v0.3.0 strengthens automatic, evidence-gated orchestration and adds portable release and Codex
plugin packaging. The exact GitHub release package is the supported upgrade path.

Upgrade from the exact release package:

```bash
npm install --save-dev "https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.0/fullstack-forge-skill-v0.3.0.tgz"
# NOT YET AVAILABLE until the v0.3.0 GitHub Release is published.
npx --no-install forge update all
npx --no-install forge doctor
```

## What changes

- Host skill roots contain generated thin adapters that resolve one canonical managed playbook tree.
- Automatic module selection requires affirmative repository or request evidence; unresolved
  capabilities remain unknown instead of activating silently.
- Related modules coordinate through a bounded, evidence-gated direct dependency hop. Explicit
  module intent still wins, while broad `all`, `discover`, and `ship` workflows remain explicit.
- Audit, fix, and verification execution preserve terminal command evidence and fail closed when an
  applicable check cannot be authorized or run, including in offline mode.
- v0.3.0 recovery uses the exact checksummed release `.tgz` rather than rebuilding an installation
  from a tag snapshot.

Existing v0.2.2 project installations remain ownership-managed. Run `forge update all` after the
package upgrade so every installed host receives the current adapters and canonical runtime. User
files and modified Forge-owned sections remain protected by the existing conflict rules.

## Codex plugin availability

The repository includes a v0.3.0 Codex plugin manifest and npm-backed marketplace entry. The npm
package is not published by the GitHub Release workflow. Do not attempt plugin installation unless
`npm view fullstack-forge-skill@0.3.0 version` independently confirms publication; project-local
installation from the exact GitHub Release package remains the supported path.

The immutable v0.2.0, v0.2.1, and v0.2.2 tags must not be moved, rewritten, or republished.
