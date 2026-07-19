# Fullstack Forge v0.1.2

Fullstack Forge is a production engineering skill suite for AI coding agents. It discovers a real
application stack, selects only applicable modules, gathers reproducible evidence, separates safe
fixes from risky decisions, and refuses to call missing evidence a pass.

This release answers an independent conformance audit of v0.1.1. Every audit finding is closed with
executable evidence rather than documentation changes.

## What changed

**Authentication detection.** The `broken-auth` fixture contained a session cookie set to a
user-supplied email with `httpOnly: false` and `secure: false`, and the auth audit produced no
automated finding. Two analyzers now close that gap: `FF-AUTH-COOKIE-001` for weakened cookie
attributes and `FF-AUTH-SESSION-001` for request-derived session identifiers.

**Broader security coverage.** Four analyzers were added with dedicated fixture cases: SSRF
(`FF-SEC-SSRF-001`), unsafe deserialization and code evaluation (`FF-SEC-DESERIALIZE-001`), CSV
formula injection (`FF-SEC-CSV-001`), and mass assignment (`FF-SEC-MASS-ASSIGN-001`).

**Rendered-UI evidence.** A new 25th tool, `inspect-rendered-ui`, captures desktop, tablet, and
mobile screenshots plus browser console output into `.forge/evidence/ui/` using the audited
project's own Playwright installation. It is deliberately conservative: it never launches project
servers, requires an explicit URL, refuses non-loopback destinations without `--allow-run`, and
reports `BLOCKED` when Playwright is absent so rendered-state criteria stay `NOT_VERIFIED` rather
than being fabricated. Console errors produce a failing `FF-UI-CONSOLE-001` finding.

**Discipline-specific procedures.** All 42 modules previously shared one generic eight-step
inspection procedure. Each module now carries its own ordered steps — 212 in total — wrapped by a
shared scope opening and evidence closing. `forge-database` reads schema, types, cascades, and
migration history; `forge-realtime` traces connect authorization, channel isolation, reconnection,
and backpressure.

**Verification depth.** 26 of 32 evaluation cases now assert a stable automated finding ID, up from
9 of 26. The suite grew from 96 to 117 tests, with 88.8% line coverage.

**Supply chain and release integrity.** CI adds macOS, fails on stale committed `build/` output,
reports coverage, and verifies offline installation. Release archives now carry build-provenance
attestations. The release workflow derives its notes path from the tag instead of hard-coding a
version, and workflow-level write permission was replaced with job-scoped tokens.

**Provenance.** `research/LICENSE_MATRIX.md` now records a measured text-overlap comparison: zero
shared eight-word sequences across 1,967 upstream Markdown files and 766,216 shingles from all
eleven researched repositories. This matters most for Trail of Bits (CC BY-SA 4.0), where adapted
prose would impose share-alike terms incompatible with the Apache-2.0 core.

## Supported platforms

Claude Code (`.claude/skills/`), OpenAI Codex (`.agents/skills/`), Google Antigravity
(`.agents/skills/` project, `~/.gemini/config/skills/` global), Gemini CLI (`.gemini/skills/`),
Cursor (`.cursor/skills/`), Windsurf/Devin Cascade (`.windsurf/skills/`), GitHub Copilot
(`.github/skills/`), and generic Agent Skills clients. Paths and their primary sources are recorded
in `docs/PLATFORM_SUPPORT.md`.

## Installation

```bash
npm install --save-dev github:thethunderbolt/fullstack-forge-skill#v0.1.2
npx forge init all --dry-run
npx forge init all
```

Or download the archive for your agent below, verify it against `SHA256SUMS.txt`, and extract it at
the project root. Archives contain real file copies and no symlinks.

## Main commands

```bash
forge discover audit
forge security audit --json
forge uploads audit
forge all audit --scope changed --base origin/main
forge all fix --safe
forge ship --allow-run
forge tool inspect-rendered-ui http://127.0.0.1:3000/ --json
```

## Evidence model

Findings carry `id`, `section`, `title`, `severity`, `confidence`, `status`, `location`, `evidence`,
`impact`, `recommendation`, `safe_fix`, `verification`, and `standards`. Statuses are `PASS`,
`FAIL`, `WARNING`, `NOT_APPLICABLE`, `NOT_VERIFIED`, and `BLOCKED`.

A pass requires direct evidence: code with file and line references, a successful automated check, a
running-application inspection, a behavior-demonstrating test, or verified configuration output.
Static analyzers never emit `PASS` — absence of an observed defect is not a pass.

## Safety model

Audit is read-only. Project commands execute only after their local definitions are shown and
`--allow-run` is supplied. Safe fixes are bound to a confirmed finding, an exact post-audit file
hash, a structural parser, and a repository-contained path. Uninstall removes only unchanged files
recorded in its own ownership manifest. Installation refuses symlinked destinations, path traversal,
Windows device names, and modified owned files.

## Distribution files

Nine platform archives, `SHA256SUMS.txt`, and `manifest.json`. Every archive ships `LICENSE`,
`NOTICE`, and `THIRD_PARTY_NOTICES.md`. The `antigravity`, `codex`, and `generic` archives are
byte-identical because all three install to the documented `.agents/skills` destination.

## Known limitations

- Analyzers are bounded to JavaScript and TypeScript. Other stacks report `NOT_VERIFIED` with the
  missing adapter named.
- Parts of the security catalogue — CSRF, CRLF and header injection, template injection, request
  smuggling, ReDoS, prototype pollution — remain inspection criteria routed to agent-led manual
  tracing rather than dedicated analyzers.
- `inspect-rendered-ui` proves a route renders and reports console errors. It does not judge visual
  design, and it requires the audited project to install Playwright itself.
- Remote CI, registry, deployment, and production state require separate direct evidence.
- The social preview image must be uploaded manually; see `docs/RELEASING.md`.

## Attribution

Original work under Apache-2.0. Public standards (OWASP, NIST, W3C, IETF) and open-source Agent
Skills repositories were studied for concepts and interoperability facts; no third-party code,
prose, data, or branding is included. Provenance is recorded in `research/SOURCES.md` and
`research/LICENSE_MATRIX.md`. This project is independent and is not endorsed by OpenAI, Anthropic,
Google, Cursor, Windsurf/Devin, GitHub, OWASP, NIST, or W3C.
