# Commands

The 42 command skills share one evidence protocol and collectively enumerate 957 explicit inspection
criteria in `config/module-criteria.json`. Generation and validation require every criterion to
appear in its canonical and platform-specific skill; a checklist item is routing context and never
counts as evidence by itself.

`fullstack-forge` and `forge` are identical executables. Node.js 24 or newer is required.

## Audit modules

```text
forge <section> <audit|fix|verify|report> [options]
```

- `audit` discovers the project, selects applicable static inspections, and records direct evidence.
- `fix` produces a `BLOCKED` safe/risky decision boundary; the CLI never invents source edits.
- `verify` reruns inspection and keeps an unresolved result `NOT_VERIFIED` until behavior evidence
  exists.
- `report` renders the current `.forge/report.json` without claiming new checks ran.

Examples:

```bash
forge ui audit
forge security audit --json
forge uploads audit
forge queries audit
forge all audit --scope changed
forge all fix --safe
forge ship
```

The 42 valid sections are emitted by `forge list`. Unknown sections and modes fail closed.

## Installation lifecycle

Both documented installer forms are supported:

```bash
forge init --ai claude --dry-run
forge init codex
forge init --ai antigravity
forge init --ai gemini
forge init --ai cursor
forge init --ai windsurf
forge init --ai github
forge init --ai generic
forge init --ai all
forge update
forge uninstall --dry-run
forge doctor --json
forge validate
forge package
```

Use `--global` for the documented user-level target. Installation is an offline copy from bundled
assets; it creates no symlinks. Unowned conflicts fail before writes. Pre-existing identical files
remain unowned, and modified owned files are preserved during update or uninstall.

## Release gate

`forge ship` reports the detected local release scripts and returns `BLOCKED`. After reviewing those
definitions, `forge ship --allow-run` invokes their executable and argument arrays without a shell,
with a bounded working directory and timeout. Remote CI, hosting, registry, provider, and production
state still require separate evidence.

## Tool interface

```bash
forge tool detect-stack --json
forge tool discover-project
forge tool detect-project-commands
forge tool run-project-command lint --allow-run
forge tool scan-secret-patterns --json
forge tool validate-finding-schema .forge/findings.json
```

The executable tool catalog is:

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

Static matches are signals, not compliance verdicts. Secret values are redacted. Missing tools,
runtime access, or proof remain `NOT_VERIFIED` or `BLOCKED`.

## Options and exit behavior

- `--root <path>` / `--cwd <path>`: select the project root.
- `--ai <platform>` / `--platform <platform>`: select an installer platform.
- `--global`: use a verified user-level path.
- `--dry-run`: plan supported mutations without writing or removing files.
- `--json`: emit machine-readable output.
- `--offline`: assert offline intent.
- `--allow-run`: authorize one detected project script by its allowlisted name.
- `--safe`: restrict fix planning; it grants no policy or destructive authority.
- `--scope`, `--risk`, `--severity`, `--output`: command-specific selection.

Exit `0` means the command completed under its stated contract, `1` means failure/finding, and `2`
means an approval or evidence boundary blocked execution. Read the structured status rather than
treating process success alone as an audit pass.
