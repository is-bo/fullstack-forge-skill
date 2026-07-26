# Commands

Install Forge, then continue talking to your AI agent normally. Installed project instructions
activate the canonical workflow automatically; explicit commands are optional controls.

## Optional workflow commands

```text
$forge build <request>
$forge continue
$forge audit [all|area]
$forge fix [area]
$forge verify [area]
$forge ship
$forge status
$forge help
```

These are Agent Skills forms where `$skill` selection is supported. A host that exposes installed
skills as slash commands can use the equivalent `/forge audit security`; other hosts use a skill
manager or mention. Terminal equivalents use `npx forge`. See
[platform support](PLATFORM_SUPPORT.md) rather than assuming every host has identical syntax.

Explicit commands force, narrow, or expand scope while preserving evidence and approval rules.

## Installation commands

```text
forge init [platform|all]
forge update [platform|all]
forge uninstall [platform|all]
forge doctor
forge list
```

Selectors are `codex`, `claude`, `antigravity`, `gemini`, `cursor`, `windsurf`, `github`, `generic`,
`agents`, and `all`. Project installation also creates managed automatic-activation instructions.

## Expert modules

Use `forge <module> audit|fix|verify|report` for a deliberate specialist workflow. The 42 modules
remain available, but automatic work loads only relevant playbooks.

Natural-language routing is a candidate selection aid. The agent must validate module applicability
against affected paths, workspaces, frameworks, the project profile, changed files, and direct
repository evidence before treating a module as active.

## Frontend, UI, and UX shortcuts

The agent accepts these focused workflows without requiring them for normal interface work:

```text
$forge frontend
$forge frontend build
$forge frontend audit
$forge frontend fix
$forge frontend verify

$forge ui build
$forge ui review
$forge ui audit
$forge ui fix

$forge ux review
$forge ux audit
$forge ux improve
$forge ux verify
```

`review` uses the audit evidence contract. `improve` begins with the same bounded preview as `fix`.
`build` selects the agent-led UNDERSTAND → INSPECT → SELECT → DEFINE → IMPLEMENT → RENDER → VALIDATE
→ REFINE → REPORT workflow; the CLI route itself does not claim that code or visual checks ran.
Terminal equivalents use `npx forge frontend build`, `npx forge ui review`, and so on.

## Findings tools

```text
forge tool validate-finding-schema .forge/agent-findings.json
forge tool ingest-agent-findings .forge/agent-findings.json
forge tool generate-report .forge/findings.json
```

Agent ingestion accepts only agent producer types with complete provenance and writes matching
`.forge/report.json` and `.forge/report.md`.
