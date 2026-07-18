# Fullstack Forge v0.1.1 release verification

This record separates local implementation evidence from GitHub CI, publication, release-asset, and
post-publication clean-room evidence. A section marked `NOT_VERIFIED` has not been converted to
`PASS` by inference.

## Release identity

- Repository: <https://github.com/thethunderbolt/fullstack-forge-skill>
- Intended version/tag: `0.1.1` / `v0.1.1`
- Baseline `main` inspected before editing: `8c4fe21e78213c8c29ac6de10463d69460ccf890`
- Release commit: `NOT_VERIFIED` until the verified commit is pushed
- Linux and Windows CI: `NOT_VERIFIED` until remote workflows complete
- Release URL: `NOT_VERIFIED` until the immutable tag and GitHub release exist

GitHub authentication was unavailable at the start of implementation (`gh auth status` reported no
authenticated host). Publication evidence must be filled from direct GitHub results, not from local
intent.

## Baseline

Before edits, `origin` resolved to the authoritative repository, all branches and tags were fetched,
local and remote `main` both resolved to the baseline above, and the worktree was clean. Node.js
`v24.14.1` and npm `11.11.0` were used. `npm ci --ignore-scripts` installed 91 packages with zero
reported vulnerabilities, and the untouched `npm run check` completed successfully with all 36
baseline tests. Regeneration left the baseline worktree clean.

## Local implementation verification

Status: `PASS` for the local Windows checkout. Every required command below returned exit code `0`:

```text
npm ci --ignore-scripts
npm run format:check
npm run lint
npm run typecheck
npm test
npm run validate
npm run check:platforms
npm run check:links
npm run check:licenses
npm run check:branding
npm run scan:secrets
npm run check
npm run package:platforms
npm run validate:dist
npm run smoke:install
npm audit
```

`npm ci --ignore-scripts` installed 91 packages and audited 92 package records with zero
vulnerabilities. The final Node suite passed all 94 tests with no failures, skips, cancellations, or
TODOs. The aggregate `npm run check` repeated formatting, ESLint, TypeScript, the complete suite,
and all repository validators successfully.

The executable tests directly demonstrated:

- compiled-CLI safe-fix dry run, severity filtering, three real writes, complete changed-file
  reporting, and idempotence;
- stale post-audit hash rejection, risky authorization blocking, authorized project-test recording,
  and rollback after a failing regression;
- exact automated fixture findings for SQL injection, cross-tenant scope, unrestricted/public
  uploads, N+1/unbounded queries, user/tenant cache keys, and missing form labels;
- changed-scope exclusion, dirty/untracked input, import/policy/schema/migration/test expansion,
  rename/deletion handling, and unsafe/nonexistent base rejection;
- profile schema v2, explicit legacy-v1 preservation/regeneration, route visibility, and no
  automatic public-web classification for a frontend;
- resolved, unresolved, disappeared-but-unverified, blocked, and regressed finding verification;
- every required ship blocking condition, including stale/cross-root evidence, open high/critical
  findings, missing security/authorization/tenant/upload/migration evidence, failed internal gates,
  and refusal to run project commands before a valid audit preflight; and
- Antigravity/Gemini project and user destinations, portable Windows path rejection, symlink
  refusal, installer ownership, and deterministic ZIP metadata.

## Generated copies and packages

Status: `PASS` locally. Generation produced 42 command skills and synchronized 57 canonical files to
all six generated roots. Validation passed for 43 canonical skills, schemas, and interface metadata;
the platform check confirmed all six ownership manifests. Link validation covered 397 Markdown files
and 124 references, license validation covered 91 dependencies, branding validated all three assets,
and the secret scan covered 624 files with zero findings.

Packaging produced exactly nine v0.1.1 archives plus `manifest.json` and `SHA256SUMS.txt`.
`validate:dist` confirmed version `0.1.1`, nine archives, and 987 entries. A second build compared
all 11 release-file SHA-256 values byte-for-byte and passed. The packager now removes only a prior
manifest's hash-unchanged stale artifacts; nine ignored, reproducible local v0.1.0 ZIPs were removed
from `dist` before the exact-set check. The public v0.1.0 tag and release were not modified.

The isolated offline package smoke passed with package `fullstack-forge-skill-0.1.1.tgz`, CLI
version `0.1.1`, ownership records removed after uninstall, Antigravity project `.agents/skills`,
Antigravity user `.gemini/config/skills`, Gemini project `.gemini/skills`, and zero
symlinks/reparse-point links.

Local candidate archive hashes:

```text
c41ba951ccc766fd94f97a75a38a0c156f1ebdf40e44f550e7e399474eaa08ea  fullstack-forge-all-v0.1.1.zip
e176132659d097d38fb3fb0188575052c90c423c638fea8f5c08b09c0bf8c8a3  fullstack-forge-antigravity-v0.1.1.zip
d545ac82031d04122ac6c3fe1b23fd1d87896cd2d7dbd8b18374a4bbf7318522  fullstack-forge-claude-v0.1.1.zip
e176132659d097d38fb3fb0188575052c90c423c638fea8f5c08b09c0bf8c8a3  fullstack-forge-codex-v0.1.1.zip
1b3006ddcc429a8dd012b6351ca2e83f1e60e827d0f9f8dafcf5234d39bce27d  fullstack-forge-cursor-v0.1.1.zip
0d01ea88ceb45024c155dd567b8e8392824541ca1925b1fe1ba847d71fe75a25  fullstack-forge-gemini-v0.1.1.zip
e176132659d097d38fb3fb0188575052c90c423c638fea8f5c08b09c0bf8c8a3  fullstack-forge-generic-v0.1.1.zip
80c108a9ea62af4dec18f326dd4ab767f0d7e260a85efd42e81d351b39716f09  fullstack-forge-github-v0.1.1.zip
722c37cfba1fa11540af66c9804e169ca6b2a84c9675f602e4886a768f1cb353  fullstack-forge-windsurf-v0.1.1.zip
```

## GitHub publication and CI

Status: `NOT_VERIFIED`. Fill this section only after authenticating, proving repository push access,
pushing the verified commit, observing both Linux and Windows CI, creating `v0.1.1`, and verifying
the release workflow. Preserve the public `v0.1.0` tag unchanged.

## Release assets

Status: `NOT_VERIFIED`. The published release must contain the expected platform archives,
`SHA256SUMS.txt`, and `manifest.json`. Each downloaded asset must be hashed independently and then
validated for safe paths, regular files, fixed metadata, CRCs, required contents, license and notice
files, exact archive set, and absence of symlinks or reparse points.

## Published clean-room installation

Status: `NOT_VERIFIED`. After publication, use fresh temporary roots and the public tag or
downloaded assets to verify generic Agent Skills, Codex, Antigravity project and user scope, Gemini
CLI project and user scope, Claude Code, Cursor, Windsurf, and GitHub Copilot. Run `forge doctor`,
skill validation, safe and risky fix cases, changed-scope audit,
security/uploads/database/queries/full audits, ship gates, checksum validation, and archive
installation without relying on the working copy.

## Remaining manual limitations

- Unsupported languages, frameworks, browser flows, assistive-technology behavior, database query
  plans, provider state, production state, and operator-only actions remain `NOT_VERIFIED`.
- Credential-template redaction does not rotate a real provider credential; rotation remains a
  manual step.
- Product, identity, authorization, tenancy, upload-policy, AI-authority, financial, destructive,
  deployment, and infrastructure decisions remain approval-bound.
- The repository social preview remains a manual administrator upload until visually confirmed.
- Antigravity's official skill-authoring codelab contains a later aside with older conflicting path
  names; the installer follows its explicit project/user installation section and records the
  ambiguity in `docs/PLATFORM_SUPPORT.md`.
