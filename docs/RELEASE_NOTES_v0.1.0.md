# Fullstack Forge v0.1.0 — First supported agent-first release

Fullstack Forge makes AI coding agents build production-ready applications by default. Install it in
a project and continue working normally: supported agents automatically apply the relevant
production engineering playbooks to features, fixes, refactors, migrations, tests, performance work,
and releases.

## Install

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.1.0"
npx forge init
npx forge doctor
```

Then ask for the software change directly. Explicit `$forge` and `npx forge` commands remain
available when a specific Build, Audit, Fix, Verify, or Ship workflow is wanted.

## Highlights

- Automatic project activation for Codex, Claude Code, Cursor, Gemini CLI, Antigravity, Windsurf,
  GitHub Copilot, and generic Agent Skills hosts.
- Ownership-safe managed project instructions that preserve user content and refuse unsafe symlinked
  or modified destinations.
- A proportional light/standard/high-risk workflow that does not run every module or full suite for
  every edit.
- 42 agent-guided production engineering modules with deterministic automation where supported.
- Official agent-authored finding producers and schema-validated ingestion into matching Markdown
  and JSON reports.
- Backward-compatible optional commands for Build, Audit, Fix, Verify, Ship, Status, and Help.
- Deterministic platform archives, checksums, manifests, clean-install tests, and fail-closed Ship
  gates.

## Version reset

Earlier numbered snapshots were rapid development previews. `v0.1.0` is the first intentionally
supported public release of the agent-first Fullstack Forge product. Commit history remains intact;
the release process does not rewrite history or claim that earlier development did not exist.

## Limitations

Forge guides an AI agent and automates only supported evidence paths. It is not a compliance
certificate, penetration test, production-access substitute, or guarantee that an unavailable
provider, browser, database, or human decision passed. Live host UI behavior, remote CI, and
publication are reported only when directly observed.
