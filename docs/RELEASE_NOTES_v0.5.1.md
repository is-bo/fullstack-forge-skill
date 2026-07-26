# Release notes — v0.5.1

Fullstack Forge v0.5.1 makes the Codex skill picker a truthful beginner entrance without changing
the underlying Build, Audit, Fix, Verify, or Ship contracts.

Remote CI, tagging, publication, provenance, release immutability, and post-publication installation
remain pending until the authorized GitHub workflows run.

## Codex onboarding

- **Forge** now appears with the preview **Build · Audit · Fix · Verify · Ship · Status** and the
  existing Fullstack Forge icon.
- Selecting Forge without an action shows Build, Continue, two Audit scopes, safe-fix preview and
  explicit safe application, Verify, Ship, Status, and Help.
- The default prompt accepts plain language; `audit data` asks a compact clarification, while
  `audit database and queries` routes to both disciplines.
- **Fullstack Forge — Expert Audit** remains the advanced `$fullstack-forge` entry.

Codex exposes one Forge skill as the visible product entrance. Its actions are routed internally;
they do not appear as separate nested native picker commands.

## Supported agents and distribution

The same 46-skill bundle remains available for Codex, Claude Code, Cursor, Gemini CLI, Antigravity,
Windsurf/Devin Cascade, GitHub Copilot, and generic Agent Skills hosts. The release workflow builds
the all-platform archive plus Codex, Claude, Cursor, Gemini, Antigravity, Windsurf, GitHub, and
generic selector archives, `SHA256SUMS.txt`, and `manifest.json`.

Router metadata and its icon are canonical, generated, hash-owned files. Archives reject private
specifications, local Forge state, credentials, temporary files, undeclared paths, and symbolic
links.

## Install

Fullstack Forge is distributed from GitHub rather than the public npm registry. After the immutable
v0.5.1 tag exists:

```bash
npm install --save-dev github:thethunderbolt/fullstack-forge-skill#v0.5.1
npx forge init
npx forge doctor
```

Restart Codex after installation if the new picker preview is not visible.

## Commands

```text
$forge build secure customer login
$forge continue
$forge audit
$forge audit all
$forge audit authentication
$forge fix
$forge fix --safe
$forge verify
$forge ship
$forge status
$forge help
```

Expert `$fullstack-forge`, `$forge-new`, `$forge-feature`, and `$forge-<area>` invocations remain
available.

## Evidence and safety

This patch introduces no evidence producer, alternate PASS route, automatic risky fix, implicit
`--safe`, implicit `--allow-run`, project-script execution, browser installation, server launch, or
Build-to-Ship authority. Audit remains read-only by default. Missing or unavailable evidence remains
`NOT_VERIFIED` or `BLOCKED`, and remote CI, release, provider, deployment, and production claims
still require direct evidence.

## Known limitations

- Generated metadata and clean installation can be verified automatically; final picker rendering
  requires restarting and visually checking Codex.
- Other supported agents receive valid skill files under the repository's existing packaging model,
  but may ignore OpenAI-specific UI metadata.
- Browser, assistive-technology, provider, database, deployment, production, and human policy
  evidence still requires the corresponding environment.

## Attribution and brand assets

The change adds no third-party source or copied prose. Existing attribution in
`research/SOURCES.md`, `research/LICENSE_MATRIX.md`, and `THIRD_PARTY_NOTICES.md` remains unchanged.
The existing 512×512 Forge icon is reused; no new generated image was introduced. GitHub
social-preview upload is still a separate repository-administrator action and is not claimed
complete here.
