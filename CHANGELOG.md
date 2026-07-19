# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic
versioning.

## [Unreleased]

## [0.1.2] - 2026-07-19

Independent audit response. Every finding from the v0.1.1 conformance audit is addressed with
executable evidence rather than documentation.

### Added

- Authentication analyzers for weakened session-cookie attributes (`FF-AUTH-COOKIE-001`) and
  request-derived session identifiers (`FF-AUTH-SESSION-001`). The `broken-auth` fixture previously
  produced no automated finding despite `httpOnly: false`, `secure: false`, and a user-controlled
  cookie value.
- Security analyzers for SSRF (`FF-SEC-SSRF-001`), unsafe deserialization and code evaluation
  (`FF-SEC-DESERIALIZE-001`), CSV formula injection (`FF-SEC-CSV-001`), and mass assignment
  (`FF-SEC-MASS-ASSIGN-001`), each with a dedicated fixture case.
- `inspect-rendered-ui`, a 25th executable tool that captures desktop, tablet, and mobile
  screenshots plus browser console output into `.forge/evidence/ui/` using the audited project's own
  Playwright installation. It reports `BLOCKED` when Playwright or a reachable URL is absent,
  refuses non-loopback destinations without `--allow-run`, never launches project servers, and emits
  `FF-UI-CONSOLE-001` for console errors.
- Per-module inspection procedures in `config/module-procedures.json`: 212 discipline-specific steps
  replacing the single generic eight-step block that every module previously shared.
- `npm run offline:install`, verifying that the packed artifact installs with `--offline`
  (cache-only, no network requests) and generates all six platform roots against an unreachable
  registry.
- `npm run test:coverage` using Node's experimental coverage reporter.
- Build-provenance attestation for every published release archive.
- A measured text-overlap comparison in `research/LICENSE_MATRIX.md`: zero shared eight-word
  sequences across 1,967 upstream Markdown files and 766,216 shingles from all eleven researched
  repositories.

### Changed

- CI runs on macOS in addition to Linux and Windows, fails on stale committed `build/` output, and
  verifies offline installation.
- The release workflow derives its notes path from the tag instead of hard-coding v0.1.1, and drops
  workflow-level write permission in favor of job-scoped tokens.
- Smoke installation asserts the CLI version from `package.json` rather than a hard-coded string.
- `research/SOURCES.md` records a per-row retrieval date for each vendor documentation source, which
  is not version-addressable the way a Git commit is.
- 26 of 32 evaluation cases now assert a stable automated finding ID, up from 9 of 26.

## [0.1.1] - 2026-07-18

### Added

- Typed JavaScript/TypeScript analyzers for supported security, authorization, tenancy, upload,
  query, cache, accessibility, AI, payment, and integration boundaries, with executable fixture
  evaluations and finding-specific verification plans.
- A bounded safe-fix registry for environment-template placeholders, JSX reverse-tabnabbing
  protection, and existing Vercel global header rules, including dry runs, exact audit hashes,
  idempotency, rollback metadata, and risky-change refusal.
- Git-aware changed-scope analysis with merge-base, staged, unstaged, untracked, rename, deletion,
  import, workspace, schema, policy, route, test, and generated-artifact impact evidence.
- Project-profile schema v2 with structured applications, routes, roles, tenant boundaries,
  workflows, providers, infrastructure, and deployment records.
- An explicit Forge release-gate registry combining internal, project-native, prior-audit, and
  capability evidence.

### Changed

- Antigravity project installation remains `.agents/skills/`, while Antigravity global installation
  now uses the separately modeled `.gemini/config/skills/` destination. Gemini CLI and generic Agent
  Skills retain their distinct project and user paths.
- Verification preserves original audit evidence and distinguishes direct structural resolution,
  unresolved findings, disappeared-but-unverified patterns, blocked commands, and regressions.
- Public documentation now describes bounded analyzers and executable safe fixes without treating
  keyword inventories as complete audits.
- Distribution packaging removes only stale, manifest-owned, hash-unchanged artifacts when a version
  changes and refuses modified or unsafe ownership records.

### Historical unreleased work included

- Expanded all 42 command skills with an explicit 957-item inspection-criteria catalog and validated
  references to the bundled executable tools.
- Kept Dependabot focused on shipped dependencies by excluding deliberately noninstallable static
  fixture manifests and holding compiler/type majors to the supported Node.js 24 toolchain.

## [0.1.0] - 2026-07-18

### Added

- Canonical Fullstack Forge orchestrator and 42 self-contained command skills.
- Evidence, finding, discovery, safe-fix, completion, and release-readiness protocols.
- TypeScript CLI with discovery, scanners, reports, validation, platform installation, updates, safe
  uninstall, doctor, packaging, and ship commands.
- Generated Agent Skills copies for Claude Code, Codex/Antigravity/generic agents, Gemini CLI,
  Cursor, Windsurf/Devin Cascade, and GitHub Copilot.
- Deterministic ZIP archives, SHA-256 checksums, ownership manifests, clean-install smoke tests,
  fixtures, CI, research attribution, and original branding.

[Unreleased]: https://github.com/thethunderbolt/fullstack-forge-skill/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.2
[0.1.1]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.1
[0.1.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.0
