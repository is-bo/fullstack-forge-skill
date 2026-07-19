# Commands

The 42 command skills share one evidence protocol and collectively enumerate 957 explicit inspection
criteria in `config/module-criteria.json`. Generation and validation require every criterion to
appear in its canonical and platform-specific skill; a checklist item is routing context and never
counts as evidence by itself.

Each module also carries its own ordered inspection procedure from `config/module-procedures.json`
(212 discipline-specific steps in total). The generator wraps those steps with a shared scope-and-
applicability opening and a shared evidence-and-findings closing, so every module states how to
inspect its own domain rather than repeating one generic checklist.

`fullstack-forge` and `forge` are identical executables. Node.js 24 or newer is required.

## Audit modules

```text
forge <section> <audit|fix|verify|report> [options]
```

- `audit` discovers the project, runs bounded analyzers for supported JavaScript, TypeScript, JSON,
  YAML, HTML, JSX, and configuration shapes, and records direct evidence. Unsupported stacks remain
  `NOT_VERIFIED`; text matches are discovery signals, not proof of a completed audit.
- `fix` loads a confirmed finding from the previous report and can apply only a registered,
  structurally validated safe fix whose evidence and file hash are still current.
- `verify` executes the finding's recorded verification plan. A disappeared pattern remains
  `NOT_VERIFIED` unless the requested behavior is directly demonstrated.
- `report` renders the current `.forge/report.json` without claiming new checks ran.

Examples:

```bash
forge ui audit
forge security audit --json
forge uploads audit
forge queries audit
forge all audit --scope changed
forge all audit --scope changed --base origin/main
forge all fix --safe
forge all fix --safe --dry-run --json
forge ship
```

The v0.1.1 safe-fix registry supports three deliberately narrow transformations:

- replace actual-looking values in environment example/template files with explicit placeholders;
- add `rel="noopener noreferrer"` to a structurally proven HTML/JSX `target="_blank"` link; and
- add `X-Content-Type-Options: nosniff` to a supported structured Vercel global-header rule.

The engine records planned operations and rollback data, rejects symlinks and paths outside the
repository, verifies the post-audit hash before writing, and reruns the named analyzer afterward.
When `--allow-run` is supplied and a project-native `test` command was detected, it runs that
bounded argument vector, records exit code/output/duration, and rolls the edits back if the
regression fails. Credential replacement does not rotate a provider secret, so that finding remains
`NOT_VERIFIED` until rotation is confirmed. Authorization, tenancy, uploads, AI, payments,
integrations, and any policy-bearing remediation remain `BLOCKED` pending explicit human decisions.

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

`forge ship` evaluates an explicit Forge gate registry: finding/schema validation, skill and
generated-copy synchronization, secret/dependency/license/archive/package/install/evaluation checks,
project-native commands, previous findings, and applicable authorization, tenancy, upload,
migration, and security capabilities. It verifies the report root and current source-evidence hashes
and preserves the prior audit findings in the ship report. Project scripts supplement the internal
gates; a project with no recognized commands cannot pass by omission. `forge ship --allow-run` is
required before invoking project-defined scripts, which run as bounded argument vectors without a
shell. Remote CI, hosting, registry, provider, and production state still require separate evidence.

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
- `--base <ref>`: select the Git merge-base reference for a changed-scope audit.
- `--scope`, `--risk`, `--severity`, `--output`: command-specific selection.

Exit `0` means the command completed under its stated contract, `1` means failure/finding, and `2`
means an approval or evidence boundary blocked execution. Read the structured status rather than
treating process success alone as an audit pass.
