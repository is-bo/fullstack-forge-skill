# Fullstack Forge v0.1.1

Fullstack Forge v0.1.1 turns the v0.1.0 audit interfaces into bounded executable behavior while
preserving the orchestrator, all 42 command skills, 957 inspection criteria, generated platform
copies, installer protections, deterministic archives, and historical release evidence.

## Executable audit and fix behavior

- JavaScript and TypeScript fixtures now run compiler-backed analyzers for supported security,
  authorization, tenancy, uploads, queries, cache, accessibility, AI, payments, and integrations.
- Findings include stable IDs, exact file/line evidence, source/sink traces, evidence hashes,
  verification plans, recommendations, safe-fix eligibility, and standards.
- `forge <section> fix [--safe]` and `forge all fix --safe` apply only registered, deterministic,
  local fixes whose post-audit hashes and structural preconditions still match.
- Automatic fixes cover credential placeholders in environment templates, `noopener noreferrer` on
  proven JSX `target="_blank"` links, and `X-Content-Type-Options: nosniff` in an existing global
  Vercel header rule. Provider-side rotation and policy-bearing changes remain manual or blocked.
- Dry runs list every operation without modifying files; applied fixes report every changed file;
  repeated runs are idempotent; authorization, tenancy, uploads, AI, and financial changes remain
  approval-bound.

## Scope, discovery, verification, and ship

- `forge all audit --scope changed [--base <ref>]` records the resolved base and merge base, dirty
  working-tree state, renames/deletions, impacted imports/workspaces/schemas/policies/routes/tests,
  affected applications, excluded applications, and module-selection reasons.
- Project-profile schema v2 adds structured records for applications, routes and visibility,
  languages, frameworks, data and storage boundaries, roles, tenants, jobs, tests, CI, providers,
  deployment, environment templates, and critical workflows. Existing schema-v1 profiles are
  detected and regenerated.
- Finding-specific verify mode re-runs named analyzers and approved targeted commands, retaining
  command output, exit code, duration, and original audit evidence. Pattern disappearance is not a
  pass unless the registered structural assertion directly proves the requested property.
- `forge ship` uses explicit internal, project-native, audit-evidence, and capability gates. Missing
  scripts, open critical/high findings, missing high-risk evidence, platform drift, incomplete
  packaging, failed smoke installation, stale audit source hashes, and invalid license/attribution
  evidence fail closed. Ship reports retain the original audit findings.

## Platform destinations

- Antigravity project/workspace: `<project>/.agents/skills/`
- Antigravity global/user: `~/.gemini/config/skills/`
- Gemini CLI project: `.gemini/skills/` (or `.agents/skills/` alias)
- Gemini CLI user: `~/.gemini/skills/` (or `~/.agents/skills/` alias)
- Generic Agent Skills project/user: `.agents/skills/` and `~/.agents/skills/`

The Antigravity paths were rechecked against official Google Codelabs on 2026-07-18. One longer
codelab contains a conflicting later Antigravity CLI-specific aside; Fullstack Forge follows the
same codelab's product-level scope table and records the ambiguity in `docs/PLATFORM_SUPPORT.md`.

## Installation

```bash
npm install --save-dev github:thethunderbolt/fullstack-forge-skill#v0.1.1
npx forge init all --dry-run
npx forge init all
```

The GitHub release contains the all-platform bundle and platform-specific Claude, Codex,
Antigravity, Gemini, generic, Cursor, Windsurf, and GitHub Copilot archives, plus `SHA256SUMS.txt`
and `manifest.json`.

## Limitations

The analyzers are intentionally bounded to supported JavaScript/TypeScript and structured
configuration shapes. Unsupported languages/frameworks and unavailable browser, database, provider,
production, operator, or assistive-technology evidence remain `NOT_VERIFIED`. Manual evaluation
cases stay manual. Fullstack Forge is not a compliance certificate, penetration test, legal opinion,
financial audit, or substitute for production access.

GitHub social-preview upload remains a manual repository-administrator step using
`docs/assets/fullstack-forge-social-preview.png`.
