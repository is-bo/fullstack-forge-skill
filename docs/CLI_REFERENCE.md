# CLI reference

Both `fullstack-forge` and `forge` execute the same CLI. Node.js 24 or newer is required.

## Module commands

```text
forge <section> <mode> [options]
```

Modes:

- `audit`: discover and inspect without changing product behavior.
- `fix`: apply only a registered safe transformation bound to a confirmed finding, current file
  hash, exact preconditions, contained regular-file paths, and a finding-specific verification.
- `verify`: execute each finding's analyzer, structural assertion, approved command, fixture, or
  manual verification plan while preserving the original evidence.
- `report`: render `.forge/report.json`.

Examples:

```bash
forge ui audit
forge security audit --json
forge uploads verify
forge all audit --scope changed
forge all audit --scope changed --base origin/main
forge all audit --scope full --risk high
forge all fix --safe --dry-run
```

## Release gate

```bash
forge ship
forge ship --allow-run
```

Both forms evaluate the explicit internal, audit-evidence, capability, and project-native gate
registry. Without `--allow-run`, an applicable project-defined command is `BLOCKED`; after review,
the flag executes its bounded argument vector without a shell. A missing recognized command cannot
produce a pass by omission. The command records exit code, output, and duration and stops after the
first failure. Remote CI, GitHub release, registry, deployment, and production state still require
separate direct evidence.

## Platform lifecycle

```bash
forge init codex --dry-run
forge init all
forge update claude
forge uninstall cursor --dry-run
forge doctor
```

Selectors: `claude`, `codex`, `antigravity`, `gemini`, `cursor`, `windsurf`, `github`, `generic`,
`agents`, and `all`. Codex, generic, and agents select `.agents/skills/`. Antigravity uses that
project path but has its own global destination, `~/.gemini/config/skills/`; it is not a global
generic-agent alias. Add `--global` for each product's documented user-level path.

Install conflicts fail before writes. Pre-existing identical files are recorded as unowned and are
left in place on uninstall. Modified owned files are preserved and reported.

## General options

- `--root <path>` / `--cwd <path>`: selected project root; defaults to current directory.
- `--json`: machine-readable output.
- `--dry-run`: plan supported writes/removals without changing files.
- `--global`: user-level installation target.
- `--offline`: assert offline intent; package smoke installation is local/offline.
- `--allow-run`: explicit authorization for reviewed local project scripts.
- `--safe`: restrict fix planning to safe classifications; never expands mutation authority.
- `--base <ref>`: validated Git base reference for a changed-scope audit.
- `--scope`, `--risk`, `--severity`, `--output`: command-specific filters or output location.

Unknown flags, platforms, modules, tools, modes, escaping paths, and symlinked destinations fail
closed.

## Tools

```bash
forge tool detect-stack --json
forge tool discover-project
forge tool detect-project-commands
forge tool run-project-command lint --allow-run
forge tool scan-secret-patterns --json
forge tool inspect-rendered-ui http://127.0.0.1:3000/ --json
forge tool validate-finding-schema .forge/findings.json
forge tool check-platform-assets
forge tool smoke-install
```

Available tools:

```text
detect-stack                 discover-project
detect-project-commands      run-project-command
inspect-env-template         scan-secret-patterns
inspect-routes               inspect-auth-boundaries
inspect-authorization        inspect-upload-pipeline
inspect-database-schema      inspect-query-patterns
inspect-cache-usage          inspect-dependencies
inspect-ci                   inspect-deployment-config
inspect-platform-skills      inspect-rendered-ui
generate-report              validate-finding-schema
validate-skill               sync-platform-assets
check-platform-assets        package-platforms
smoke-install
```

Secret matches are redacted. Compiler-backed and structured analyzers prove only their supported
shapes; keyword inventory remains a discovery signal, not a compliance verdict. Unsupported stacks
remain `NOT_VERIFIED`. A nonzero scanner exit preserves an observed failure; it is not a tool crash
by definition.

`inspect-rendered-ui` captures desktop, tablet, and mobile screenshots plus browser console output
into `.forge/evidence/ui/` using the audited project's own Playwright installation. Start the
application yourself and pass its URL; the tool never launches project servers or guesses addresses.
Loopback URLs work by default; any other destination requires explicit `--allow-run`. When
Playwright is absent the tool reports `BLOCKED` and rendered-state criteria stay `NOT_VERIFIED` — it
never fabricates visual evidence. Console errors on an inspected route produce a failing
`FF-UI-CONSOLE-001` finding with the captured log as evidence.
