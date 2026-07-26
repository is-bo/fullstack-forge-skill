# Commands

The 42 audit command skills plus the simple `forge` router and the two expert Build skills,
`forge-new` and `forge-feature`, share one evidence protocol; the audit set collectively enumerates
957 explicit inspection criteria in `config/module-criteria.json`. Generation and validation require
every criterion to appear in its canonical and platform-specific skill; a checklist item is routing
context and never counts as evidence by itself.

Each module also carries its own ordered inspection procedure from `config/module-procedures.json`
(212 discipline-specific steps in total). The generator wraps those steps with a shared scope-and-
applicability opening and a shared evidence-and-findings closing, so every module states how to
inspect its own domain rather than repeating one generic checklist.

`fullstack-forge` and `forge` are identical executables. Node.js 24 or newer is required.

## Simple product commands

`forge build`, `continue`, `audit`, `fix`, `verify`, `ship`, `status`, and `help` are additive
routes over the expert commands below. The generated `forge` Agent Skill exposes the same intent
surface as `/forge ...`, `$forge ...`, or named skill selection according to host capability. It is
a router, not a second evidence engine: all statuses, approvals, hashes, revisions, producers, and
Ship independence remain enforced by the existing implementation.

With no action, both the Codex skill and terminal CLI present the same action names and meanings:

```text
Build
Continue
Audit changed work
Audit the whole project
Fix — preview safe fixes
Fix — apply reviewed safe fixes
Verify
Ship
Status
Help
```

The Codex menu asks the user to choose or describe the task in plain language; it does not run an
audit, claim evidence, create state, or print the complete advanced grammar. `audit data` remains
ambiguous across analytics, database, privacy, queries, and storage, while
`audit database and queries` routes to both named disciplines.

## Audit modules

```text
forge <section> <audit|fix|verify|report> [options]
```

- `audit` discovers the project, runs bounded analyzers for supported JavaScript, TypeScript, JSON,
  YAML, HTML, JSX, and configuration shapes, and records direct evidence. Every selected module also
  records structured language/framework analyzer coverage and the exact adapter required for
  unsupported or partial shapes. Unsupported stacks remain `NOT_VERIFIED`; text matches are
  discovery signals, not proof of a completed audit.
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
forge all audit --exclude .next --exclude storage/local --inspection-budget 192MiB
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

The 42 valid sections are emitted by `forge list`. Unknown sections and modes fail closed. Audit,
Verify, and Ship share the bounded [repository inventory](REPOSITORY_INVENTORY.md). A user exclusion
or exhausted relevant-text budget remains `NOT_VERIFIED` and exits `2`.

## Build modules

```text
forge new [options]
forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status] [options]
forge resume [options]
forge migrate build [--dry-run|--resume|--rollback]
```

Build verbs are dispatched before section-slug parsing, so a build option surface never widens the
audit option type and no existing audit command changes behavior.

- `forge new` runs the new-project foundation workflow once per project and writes schema-v2
  `.forge/build/project.json`, `.forge/build/DECISIONS.md`, and `.forge/build/DESIGN.md`. Structured
  flags capture users/roles, outcomes, business invariants, workflows, sensitive data, trust
  boundaries, expected scale, stack rationale, constraints, assumptions, unresolved decisions,
  non-goals, backlog, and design direction. It refuses reinitialization unless `--force` is given.
- `forge feature <slug>` with no sub-verb starts a feature (default tier `standard`) or resumes one
  that already exists, re-verifying every evidence hash on load.
- `forge feature <slug> frame` records tier, explicit disciplines, tier inputs, touched paths,
  decisions, and assumptions, then derives discipline applicability as `REQUIRED`, `SUGGESTED`,
  `EXCLUDED`, or `UNRESOLVED`. `plan` records a plan summary and hashes it with the sorted
  discipline list; neither phase is proof.
- `forge feature <slug> check` resolves scope (Git merge-base changed-scope, falling back to
  recorded touched paths or the full worktree), runs analyzers and — with `--allow-run` — detected
  project commands only through exact registered `(script, criterion)` producers. Positive results
  receive a typed, root/revision/input/artifact/expiry-bound envelope. High-tier UI work accepts
  repeatable `--runtime-case <state>=<url>` routes, `--role`, and `--design-direction`, and requires
  the complete eight-state by three-viewport matrix. Exits 1 if any derived criterion is `FAIL` or
  the feature is now `blocked`.
- `forge feature <slug> done` re-derives applicability and its code-owned gate plan, re-verifies all
  positive envelopes in memory, and refuses (exit 1) with an actionable missing-items list until
  every required gate has verified `PASS`. A required gate is not satisfied by `NOT_APPLICABLE`.
- `forge feature <slug> accept-risk --criterion <id> --reason <text>` is allowed only by the current
  gate's waiver policy and binds root, revision, relevant file hashes, expiry, and `--actor` for an
  operational acceptance. It is never `PASS`. `abandon [--reason <text>]` is a recorded human
  decision; see [BUILD_MODE.md](BUILD_MODE.md).
- `forge feature <slug> status` renders current phase, criteria, risk acceptances, blockers, and the
  next step without changing state.
- `forge resume` enumerates canonical feature files, re-verifies evidence, re-derives planning,
  rebuilds the project index, lists unfinished features, and names the most recently updated one.
- `forge migrate build` is the only v0.2 Build-state migration path. `--dry-run` emits the complete
  plan; journaled `--resume` and hash-checked `--rollback` recover an interrupted migration. Legacy
  positive evidence and risk acceptances migrate only as expired, untrusted diagnostics.

Build-specific flags: `--tier`, `--summary`, `--reason`, `--criterion`, `--base`, `--name`,
`--scale`, `--design-ref`, `--actor`, `--risk-category <advisory|operational>`, `--url`, `--role`,
`--design-direction`, `--evidence-dir`; and repeatable `--discipline`, `--input`, `--touch`,
`--stack`, `--non-goal`, `--decision`, `--assumption`, `--user-role`, `--workflow`, `--invariant`,
`--sensitive-data`, `--trust-boundary`, `--outcome`, `--constraint`, `--project-assumption`,
`--unresolved-decision`, `--backlog`, and `--runtime-case`. Shared flags are `--root`/`--cwd`,
`--json`, `--dry-run`, `--global`, `--offline`, `--allow-run`, and `--force`. Migration alone
accepts `--resume` and `--rollback`. A feature slug must match `^[a-z0-9][a-z0-9-]{0,63}$` and
cannot equal a reserved sub-verb, audit module slug, platform name, or Windows reserved device name.

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
assets; it creates no symlinks. With no selector, `forge init` detects finite configuration markers
and executable-name hints without running them, recommends matching targets, and preserves `all` as
the compatibility default. Detection is advisory and cannot block installation. Unowned conflicts
fail before writes. Ownership preparation and same-directory atomic replacement make interrupted
installs resumable with `forge update all`. Pre-existing identical files remain unowned, and
modified owned files are preserved during update or uninstall. Doctor also checks bundled generated
copies and bounded upstream update availability; offline/unavailable lookups are explicit warnings,
not passes.

## Release gate

`forge ship` evaluates an explicit Forge gate registry after re-discovering and re-inspecting a
stable current working-tree revision. Persisted reports are diagnostics only: prior findings,
statuses, evidence, envelopes, profiles, and module decisions never determine a Ship outcome.
Application gates consume only current evidence from registered Ship producers—secret scan,
dependency and lockfile inspection, license scan, authorization, tenant, upload, security,
migration, test, or release artifact. Envelopes bind the exact root, revision, criterion, expiry,
artifacts, and, for commands, definition source, argv, input manifest, exit code, duration, and
output digest. Stale, legacy, malformed, Build-domain, or mismatched evidence blocks rather than
passes. Project scripts supplement the internal gates; a project with no recognized commands cannot
pass by omission. `forge ship --allow-run` is required before invoking project-defined scripts,
which run as bounded argument vectors without a shell. Remote CI, hosting, registry, provider, and
production state still require separate evidence.

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
- `--offline`: enforce the offline contract — non-loopback destinations and audited-project driver
  resolution are refused, and network-dependent checks report `BLOCKED`/`NOT_VERIFIED` rather than
  `PASS`. See `docs/CLI_REFERENCE.md` for the full contract.
- `--allow-run`: authorize one detected project script by its allowlisted name.
- `--safe`: restrict fix planning; it grants no policy or destructive authority.
- `--base <ref>`: select the Git merge-base reference for a changed-scope audit.
- `--scope`, `--risk`, `--severity`, `--output`: command-specific selection.

Exit `0` means the command completed under its stated contract, `1` means failure/finding, and `2`
means an approval or evidence boundary blocked execution. Read the structured status rather than
treating process success alone as an audit pass.
