# Commands

Normal software-engineering work does not require a Forge command. Installed project instructions
activate the canonical workflow automatically.

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

Terminal equivalents use `npx forge`. Explicit commands force, narrow, or expand scope while
preserving evidence and approval rules.

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

## Findings tools

```text
forge tool validate-finding-schema .forge/agent-findings.json
forge tool ingest-agent-findings .forge/agent-findings.json
forge tool generate-report .forge/findings.json
```

Agent ingestion accepts only agent producer types with complete provenance and writes matching
`.forge/report.json` and `.forge/report.md`.
