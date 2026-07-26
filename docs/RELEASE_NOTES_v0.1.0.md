# Fullstack Forge v0.1.0

Fullstack Forge is an evidence-driven production full-stack engineering skill suite for AI coding
agents. It combines one orchestrator with 42 self-contained audit skills covering product logic, UI,
UX, accessibility, frontend/backend, APIs, authentication, authorization, security, uploads,
privacy, multi-tenancy, PostgreSQL-style data design, queries, caching, testing, operations,
deployment, and specialized AI/payment/realtime/offline concerns.

All 42 command skills collectively enumerate 957 explicit inspection criteria, and validation
requires every criterion to appear in the canonical and generated platform copies.

## Supported platforms

- OpenAI Codex, Google Antigravity, and generic Agent Skills via `.agents/skills/`
- Claude Code via `.claude/skills/`
- Gemini CLI via `.gemini/skills/`
- Cursor via `.cursor/skills/`
- Windsurf/Devin Cascade via `.windsurf/skills/`
- GitHub Copilot via `.github/skills/`

## Install and invoke

Download the matching ZIP and verify it with `SHA256SUMS.txt`, or install from the tag:

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.1.0
npx forge init all --dry-run
npx forge init all
```

Representative commands:

```bash
forge ui audit
forge security audit
forge uploads audit
forge queries audit
forge all audit --scope full
forge all fix --safe
forge ship
```

## Evidence and safety model

Findings use stable identifiers and explicit `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED` states. Missing runtime, provider, database, browser, production, or
operator evidence is never converted into a pass. The installer uses ownership hashes, rejects
symlinked destinations and traversal, refuses unowned conflicts, and removes only unchanged files it
owns. Project scripts require review plus `--allow-run` and execute as argument arrays with
timeouts.

## Distribution

The release includes the all-platform bundle, platform-specific Claude/Codex/Antigravity/Gemini/
generic/Cursor/Windsurf/GitHub ZIPs, `SHA256SUMS.txt`, and a machine-readable manifest. Archives use
fixed timestamps, regular files, bundled Apache-2.0 notices, and deterministic ordering.

## Limitations and attribution

Fullstack Forge is an engineering audit aid, not a compliance certificate, penetration test, legal
opinion, accessibility-conformance claim, or substitute for production access. Static heuristics can
produce false positives and many behavior checks remain manual. Concepts were adapted from current
primary standards and licensed reference projects; revisions and handling decisions are recorded in
`research/` and `THIRD_PARTY_NOTICES.md`. Branding is original AI-assisted artwork generated with
the built-in OpenAI image capability and does not imply vendor endorsement.

GitHub social preview upload remains a manual repository-administrator step:
`Settings → General → Social preview → Edit → Upload image`, using
`docs/assets/fullstack-forge-social-preview.png`.
