# CLI reference

The CLI is deterministic support for the AI agent. It does not replace agent reasoning.

## Product surface

```text
forge build [request]
forge continue
forge audit [all|area]
forge fix [area] [--safe]
forge verify [area]
forge ship
forge status
forge help
```

## Installation

```text
forge init [selector|all] [--global] [--dry-run]
forge update [selector|all] [--global] [--dry-run]
forge uninstall [selector|all] [--global] [--dry-run]
forge doctor [--global] [--offline]
```

Project installs include automatic activation. Global installs provide skills only because no single
project instruction file exists at global scope.

## Specialist workflows

```text
forge <module> audit [--scope changed|full] [--json]
forge <module> fix [--safe] [--dry-run]
forge <module> verify [--json]
forge <module> report [--output <directory>]
```

## Tools

Use `forge list --json` for the exact tool catalog. Important agent-first tools include bounded
project discovery, safe project-command execution, report generation, finding validation,
`ingest-agent-findings`, platform synchronization, packaging, and clean-install smoke testing.

Command execution requires `--allow-run` after the detected local definition is reviewed. Offline,
network, symlink, output ownership, and repository containment policies fail closed.

## Exit semantics

- `0`: requested operation completed without an enforced failure.
- `1`: a validated finding or required gate failed.
- `2`: evidence or execution was blocked/not verified.

JSON output is the stable automation interface. Human output is intentionally concise.
