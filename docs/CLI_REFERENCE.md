# CLI reference

Both `fullstack-forge` and `forge` execute the same CLI. Node.js 24 or newer is required.

## Module commands

```text
forge <section> <mode> [options]
```

Modes:

- `audit`: discover and inspect without changing product behavior.
- `fix`: stop at a safe/risky plan; the CLI never guesses source changes.
- `verify`: rerun the module scanner against existing findings and preserve missing behavior
  evidence as `NOT_VERIFIED`.
- `report`: render `.forge/report.json`.

Examples:

```bash
forge ui audit
forge security audit --json
forge uploads verify
forge all audit --scope changed
forge all audit --scope full --risk high
```

## Release gate

```bash
forge ship
forge ship --allow-run
```

The first form displays detected release script definitions and returns `BLOCKED`. After review,
`--allow-run` executes the detected gate arguments without a shell. The command records output and
stops after the first failure. Remote CI, GitHub release, registry, deployment, and production state
still require separate direct evidence.

## Platform lifecycle

```bash
forge init codex --dry-run
forge init all
forge update claude
forge uninstall cursor --dry-run
forge doctor
```

Selectors: `claude`, `codex`, `antigravity`, `gemini`, `cursor`, `windsurf`, `github`, `generic`,
`agents`, and `all`. Codex, Antigravity, generic, and agents share `.agents/skills/`; `all` installs
that target once. Add `--global` for the documented user-level path.

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
inspect-platform-skills      generate-report
validate-finding-schema      validate-skill
sync-platform-assets         check-platform-assets
package-platforms            smoke-install
```

Secret matches are redacted. Static signals are not compliance verdicts. A nonzero scanner exit
preserves an observed failure; it is not a tool crash by definition.
