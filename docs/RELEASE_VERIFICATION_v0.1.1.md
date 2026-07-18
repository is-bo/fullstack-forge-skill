# Fullstack Forge v0.1.1 release verification

This record separates local implementation evidence from GitHub CI, publication, release-asset, and
post-publication clean-room evidence. A section marked `NOT_VERIFIED` has not been converted to
`PASS` by inference.

## Release identity

- Repository: <https://github.com/thethunderbolt/fullstack-forge-skill>
- Version/tag: `0.1.1` / `v0.1.1`
- Baseline `main` inspected before editing: `8c4fe21e78213c8c29ac6de10463d69460ccf890`
- Release commit: `e7b84035615b66537fad9a9d0e57821b30aef62a`
- Annotated tag object: `76dce46b140840a448b1bd0980b6243627029c19`
- Linux and Windows CI: `PASS` in
  [CI run #20](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29655685129)
- Release workflow: `PASS` in
  [Release run #3](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29655784324)
- Release URL: <https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.1>
- Published: `2026-07-18T18:25:07Z`

`gh auth status` reported no authenticated GitHub CLI host. Git Credential Manager nevertheless
provided repository push access: the implementation commits and the new annotated tag were pushed
directly to the authoritative origin. Publication evidence below comes from the public GitHub API,
workflow results, downloaded release assets, and the public tag rather than local intent.

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
vulnerabilities. The final aggregate run passed all 96 tests with no failures, skips, cancellations,
or TODOs. It repeated formatting, ESLint, TypeScript, the complete suite, and all repository
validators successfully. The executable tests directly demonstrated:

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
and the final secret scan covered 625 files with zero findings.

Packaging produced exactly nine v0.1.1 archives plus `manifest.json` and `SHA256SUMS.txt`.
`validate:dist` confirmed version `0.1.1`, nine archives, and 987 entries. A second build compared
all 11 release-file SHA-256 values byte-for-byte and passed. The packager now removes only a prior
manifest's hash-unchanged stale artifacts; nine ignored, reproducible local v0.1.0 ZIPs were removed
from `dist` before the exact-set check. The public v0.1.0 tag and release were not modified.

The isolated packed-package smoke passed with package `fullstack-forge-skill-0.1.1.tgz`, CLI version
`0.1.1`, ownership records removed after uninstall, Antigravity project `.agents/skills`,
Antigravity user `.gemini/config/skills`, Gemini project `.gemini/skills`, and zero
symlinks/reparse-point links. The local tarball is installed with scripts disabled; npm is allowed
to resolve its pinned TypeScript runtime dependency so a clean runner does not depend on a warm
cache.

Local candidate archive hashes:

```text
c7a4ef61c0f3151f32d5fd19637d192f0d4f8e61002aac231a8c0a100885359b  fullstack-forge-all-v0.1.1.zip
ae0279f7b936fb675bd7eb1259e748c9d4189e36a5e34d51fd0d019cebfff462  fullstack-forge-antigravity-v0.1.1.zip
1c2ced6c0aac6292e5b5472be0e537a1434e44f9cdfbc9532823c14cc3cf9cc0  fullstack-forge-claude-v0.1.1.zip
ae0279f7b936fb675bd7eb1259e748c9d4189e36a5e34d51fd0d019cebfff462  fullstack-forge-codex-v0.1.1.zip
01cbbff39c29b33cac8fa4d4854531fb1acef7914c65f6c04ea2b0f142aa2402  fullstack-forge-cursor-v0.1.1.zip
b670fd55f6b7a13f9af3a5fb8536a397bac2fb8033c8f710d1b386096d82aa6a  fullstack-forge-gemini-v0.1.1.zip
ae0279f7b936fb675bd7eb1259e748c9d4189e36a5e34d51fd0d019cebfff462  fullstack-forge-generic-v0.1.1.zip
0aaf40082ec586dfe04625f616e5239e1991b65af0af677f17e91cd79cd4822c  fullstack-forge-github-v0.1.1.zip
44bdf5a59e275ab07f9c6df316c9f8713312a7a9ecdc86d6699902a6305a5d0e  fullstack-forge-windsurf-v0.1.1.zip
```

## GitHub publication and CI

Status: `PASS` for the release commit and tag. The first two post-push CI attempts remain visible as
failures and were not reclassified:

- [CI run #16](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29655340566)
  failed on both platforms because the smoke install incorrectly required a warm offline npm cache.
- [CI run #19](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29655568510)
  passed on Windows but failed on Ubuntu because its no-link assertion traversed npm's own
  `node_modules/.bin` symlinks outside the Forge-managed install root.
- [CI run #20](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29655685129)
  passed both `Verify (ubuntu-latest)` job `88109481979` and `Verify (windows-latest)` job
  `88109481972` for release commit `e7b84035615b66537fad9a9d0e57821b30aef62a`.

The immutable annotated `v0.1.1` tag resolves to that commit.
[Release run #3](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29655784324)
independently passed locked installation, the complete check, dependency audit, packaging,
packed-artifact smoke, and publication. The existing public `v0.1.0` tag and release were not moved
or replaced.

## Release assets

Status: `PASS`. The public release exposed exactly nine platform ZIPs, `SHA256SUMS.txt`, and
`manifest.json`. All 11 assets downloaded successfully. Independent SHA-256 calculation matched all
nine checksum records and the GitHub asset digests; the archive hashes are the values recorded
above. The downloaded manifest reported version `0.1.1` and the same byte counts and hashes.

Running `npm run validate:dist` against only the downloaded files returned exit `0` and validated
nine archives with 987 entries. Fresh extraction found 43 skills and one master skill in every
platform archive, 258 skills and six master copies in the all-platform archive, and zero symlinks or
Windows reparse points in every extracted root.

## Published clean-room installation

Status: `PASS` for the supported local boundaries. The public tag was cloned at depth one into a new
temporary root and resolved to release commit `e7b84035615b66537fad9a9d0e57821b30aef62a`. The clean
clone remained clean after generation and validation. These setup commands returned exit `0` with
Node.js `v24.14.1`, npm `11.11.0`, and CLI `0.1.1`:

```text
git clone --branch v0.1.1 --depth 1 https://github.com/thethunderbolt/fullstack-forge-skill.git <fresh>/source
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node build/cli/src/index.js --version
npm run validate
```

Separate empty project roots were used for `forge init <selector> --json` followed by
`forge doctor --json`. Generic Agent Skills, Codex, Antigravity project, Gemini project, Claude
Code, Cursor, Windsurf, and GitHub Copilot each returned exit `0`, created an ownership manifest,
installed the expected master skill, and contained zero reparse points. With an isolated
`HOME`/`USERPROFILE`, Antigravity user and Gemini user installs and global doctor checks also
returned exit `0`.

The observed destinations were:

```text
Generic/Codex project       .agents/skills/
Antigravity project         .agents/skills/
Antigravity user            .gemini/config/skills/
Gemini CLI project          .gemini/skills/
Gemini CLI user             .gemini/skills/
Claude Code project         .claude/skills/
Cursor project              .cursor/skills/
Windsurf project            .windsurf/skills/
GitHub Copilot project      .github/skills/
```

Published-CLI behavior was exercised against fresh fixture copies with these exact outcomes:

- Initial safe-fixture full audit: exit `1`, emitting `FF-ENV-TEMPLATE-001`, `FF-DEPLOY-HEADER-001`,
  and `FF-FRONTEND-BLANK-001`.
- `forge all fix --safe --dry-run --json`: exit `0`; three typed operations were reported and all
  pre-run hashes remained unchanged.
- `forge all fix --safe --json`: exit `0`; it applied `FF-FIX-ENV-PLACEHOLDER-001`,
  `FF-FIX-VERCEL-NOSNIFF-001`, and `FF-FIX-BLANK-REL-001` to `.env.example`, `vercel.json`, and
  `Link.tsx`. Repeating it returned exit `0` with no changed files. A subsequent full audit returned
  exit `0` with no failed findings.
- `forge all verify --json`: exit `0`; the header and blank-link findings were directly proved as
  `PASS`, while credential rotation correctly remained `NOT_VERIFIED`.
- Risky-fixture audit: exit `1`, emitting object-authorization and upload-policy findings.
  `forge all fix --safe --json` returned exit `2` / `BLOCKED`, listed all four blocked findings, and
  changed no files.
- `forge all audit --scope changed --base HEAD --json`: exit `0`; it recorded merge base
  `d0493a5a41ebec13323e5b418cf8ce1cd86638ce`, the untracked `Link.tsx`, its inclusion reason, the
  affected application, and the always-applicable/capability modules.
- `forge security audit --json`: expected vulnerable-fixture exit `1`; exact file/line evidence was
  emitted for shell, credential, NoSQL, SQL, and validation findings.
- `forge uploads audit --json`: expected vulnerable-fixture exit `1`; exact evidence was emitted for
  public-before-scan, scanner fail-open, unrestricted upload, extension-only, and MIME-trust
  findings.
- `forge database audit --json`: exit `0` with `NOT_VERIFIED`; static query evidence did not pretend
  to prove database behavior. `forge queries audit --json`: expected vulnerable-fixture exit `1`
  with `FF-QUERY-N1-001` and `FF-QUERY-UNBOUNDED-001`.
- `forge ship --json`: exit `2` / `BLOCKED` on the risky fixture because open high findings,
  authorization/upload/security evidence, and a recognized project-native gate were not verified.

Nonzero audit exits above represent deliberately vulnerable fixtures and were asserted by finding
ID; they are not recorded as successful release candidates.

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
