# CLI reference

The CLI is deterministic support for the AI agent. It does not replace agent reasoning, and its
syntax is independent of host-specific `$forge`, `/forge`, skill-manager, or mention forms.

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
forge doctor [--global] [--offline] [--check-updates]
```

Project installs include automatic activation. Global installs provide skills only because no single
project instruction file exists at global scope.

`forge doctor` performs no remote update lookup by default. Add `--check-updates` to authorize that
network request; `--offline` continues to prohibit it.

## Specialist workflows

```text
forge <module> audit [--scope changed|full] [--request <provider-or-technology>] [--condition <task-condition>] [--risk-surface <surface>] [--json]
forge <module> compose [--request <provider-or-source>] [--condition <task-condition>] [--risk-surface <surface>] [--json]
forge <module> fix [--safe] [--dry-run]
forge <module> verify [--json]
forge <module> report [--output <directory>]
```

Interface aliases retain those audit semantics and add an honest agent-led build selector:

```text
forge frontend build [request]
forge frontend audit|fix|verify
forge ui build [request]
forge ui review|audit|fix
forge ux review|audit|improve|verify
```

`review` normalizes to `audit`; `improve` normalizes to the bounded fix preview. A scoped `build`
prints the selected modules, progressive references, and workflow with evidence status
`NOT_VERIFIED`; it does not mutate code or claim a render occurred.

`forge audit queries` is the executable equivalent of `$forge audit queries` or
`/forge audit queries` on hosts that support those skill-selection forms.

`--request` is repeatable. It records an explicitly requested provider or technology for exact,
precedence-aware composition; it never turns an unavailable source into verified evidence.
`--condition` and `--risk-surface` are also repeatable, but are valid only for task facts directly
proved from the request and affected boundary. Supported conditions are `ci`, `retrieval`,
`migration`, `threatModelling`, `gdprRelevant`, `testingApplicable`, `missingEssentialRequirements`,
`divergentExploration`, and `incidentInvestigation`; the current risk surfaces are `frontend`,
`api`, and `payments`. Unknown conditions fail closed.

Explicit `compose` intent seeds the requested module's own task surface, so greenfield frontend and
testing work still receives its primary specialist procedure before matching source files exist.
Cross-module `dependsOn` entries are coordination hints, not hard prerequisites: automatic
composition considers one direct hop, loads only dependencies with positive repository evidence, and
returns only the decisions and edges it actually considered. Cycles and merely unknown applicability
therefore cannot expand a small request into an all-module context load.

## Tools

Use `forge list --json` for the exact tool catalog. Important agent-first tools include bounded
project discovery, safe project-command execution, report generation, finding validation,
`snapshot-evidence`, `ingest-agent-findings`, platform synchronization, packaging, and clean-install
smoke testing.

Command execution requires `--allow-run` after the detected local definition is reviewed. Offline,
network, symlink, output ownership, and repository containment policies fail closed.

## Exit semantics

- `0`: requested operation completed without an enforced failure.
- `1`: a validated finding or required gate failed.
- `2`: evidence or execution was blocked/not verified.

JSON output is the stable automation interface. Human output is intentionally concise.
