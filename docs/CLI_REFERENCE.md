# CLI reference

Audit, Verify, and Ship accept repeatable `--exclude <repository-relative-path>` and a strict,
bounded `--inspection-budget <bytes|KiB|MiB>` (maximum 512 MiB). These options are visible in JSON
and reports. They cannot turn incomplete evidence into `PASS`; affected checks remain `NOT_VERIFIED`
and exit `2`. See [Repository inventory](REPOSITORY_INVENTORY.md).

Both `fullstack-forge` and `forge` execute the same CLI. Node.js 24 or newer is required.

## Simple commands

These are the default product surface. They route into the same Build, Audit, Fix, Verify, and Ship
engines described below.

```text
forge                              Guided menu in a TTY; numbered list otherwise
forge build [plain-language request]
forge continue
forge audit [all|area]
forge fix [area] [--safe]
forge verify [area]
forge ship
forge status
forge help
forge help advanced
```

The no-argument menu labels these actions as Build, Continue, Audit, Fix, Verify, Ship, Status, and
Help. It separates Audit changed work from Audit the whole project, and separates the no-write Fix
preview from the explicit reviewed `fix --safe` application. Noninteractive menu rendering exits
without creating `.forge/build/`, audit reports, or other files.

`forge audit` prefers changed scope only when a reliable Git base exists; otherwise it explicitly
uses full scope. `audit all` is always full. Natural-language area mappings fail on ambiguity.
`forge fix` is a preview until `--safe` is supplied. Concise output is the default for these simple
commands; use `--details` for full Markdown or `--json` for the stable technical structure. Missing
or blocked evidence is preserved and can make the command exit `2`.

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
- `report`: render `.forge/report.json` to stdout or to a directory. Never re-runs the audit.

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

## Build commands

```text
forge new [--tier <light|standard|high>] [--summary <text>] [--name <text>]
          [--user-role <user:role,role>]... [--outcome <text>]... [--invariant <text>]...
          [--workflow <text>]... [--sensitive-data <text>]... [--trust-boundary <text>]...
          [--scale <text>] [--stack <name:rationale>]... [--constraint <text>]...
          [--project-assumption <text>]... [--unresolved-decision <text>]...
          [--non-goal <item:reason>]... [--backlog <text>]... [--design-ref <path>] [--force]
forge feature <slug> [options]
forge feature <slug> frame [--tier <tier>] [--discipline <slug[:reason]>]... [--input <text>]...
                           [--touch <path>]... [--decision <text>]... [--assumption <text>]...
forge feature <slug> plan [--summary <text>] [--discipline <slug[:reason]>]... [--decision <text>]...
forge feature <slug> check [--allow-run] [--base <ref>] [--offline]
                           [--runtime-case <state>=<url>]... [--url <success-url>]
                           [--role <role>] [--design-direction <follows|deviation:reason>]
                           [--evidence-dir <path>]
forge feature <slug> done
forge feature <slug> accept-risk --criterion <id> --reason <text>
                                 [--risk-category <advisory|operational>] [--actor <human>]
forge feature <slug> abandon [--reason <text>]
forge feature <slug> status
forge resume
forge migrate build [--dry-run|--resume|--rollback]
```

Build verbs (`new`, `feature`, `resume`) are dispatched before any module-slug parsing, so their
flags never widen the audit `Options` type. Every verb accepts `--root`/`--cwd`, `--json`, and
`--dry-run`; `check` additionally accepts `--allow-run`, `--base`, and `--offline` and reuses the
same execution substrate as `forge <section> audit` — the same argv-array command runner, ledger,
net/offline policy, redaction, `scope.ts` expansion, analyzers, and verification plans, with no new
subprocess or network path.

`forge feature <slug> check` and `done` are the enforced half of the lifecycle. They re-derive
classified applicability and a code-owned tier gate plan, and accept positive outcomes only from an
exact registered producer with a verified, unexpired root/revision/input/artifact-bound envelope.
`frame` and `plan` only record what is passed to them. `forge migrate build` is the only supported
schema-v1 to schema-v2 path; it validates everything before writing and journals hash-bound backups
for resume or rollback. See [BUILD_MODE.md](BUILD_MODE.md) for the producer contract, runtime
matrix, risk policy, migration, and limitations.

## Release gate

```bash
forge ship
forge ship --allow-run
```

Both forms evaluate the explicit internal, typed evidence, capability, and project-native gate
registry after fresh discovery and bounded inspection of a stable current revision. Prior reports
are diagnostics only and Build-domain evidence is categorically ineligible. Secret, dependency,
lockfile, license, authorization, tenant, upload, migration, test, and release-artifact evidence
must match a registered Ship producer and a verified envelope. Without `--allow-run`, an applicable
project command is `BLOCKED`; after review, the flag executes its bounded argument vector without a
shell and binds the command definition source, argv, input manifest, exit code, duration, output
digest, root, and revision. A missing recognized command cannot pass by omission. Remote CI, GitHub
release, registry, deployment, and production state still require separate direct evidence.

## Platform lifecycle

```bash
forge init codex --dry-run
forge init
forge update claude
forge uninstall cursor --dry-run
forge doctor
```

Selectors: `claude`, `codex`, `antigravity`, `gemini`, `cursor`, `windsurf`, `github`, `generic`,
`agents`, and `all`. Codex, generic, and agents select `.agents/skills/`. Antigravity uses that
project path but has its own global destination, `~/.gemini/config/skills/`; it is not a global
generic-agent alias. Add `--global` for each product's documented user-level path.

With no selector, `init` keeps the compatible `all` default, detects only finite known configuration
markers and executable filenames on absolute `PATH` entries, and recommends narrower selectors
without running an executable or claiming that a host application is installed. Detection failure is
advisory and cannot block installation. Install conflicts fail before writes. Ownership for absent
targets is atomically recorded before new managed content; updates atomically replace files while
the old manifest hash remains recoverable. Re-running `forge update all` therefore resumes an
interrupted install. Pre-existing identical files are recorded as unowned and left in place on
uninstall. Modified owned files are preserved and reported.

Doctor validates runtime and Git versions, the bundled canonical/generated catalog, installed
ownership/integrity/destinations, project commands and Build state, optional rendered-UI support,
repository state, report freshness, and update availability. The update lookup uses the fixed
upstream Git URL. A newer release, `--offline`, or an unavailable lookup is an explicit advisory
warning; required local checks can still be ready.

## General options

- `--root <path>` / `--cwd <path>`: selected project root; defaults to current directory.
- `--json`: machine-readable output.
- `--dry-run`: plan supported writes/removals without changing files.
- `--global`: user-level installation target.
- `--offline`: enforce the offline contract (see below); it is not advisory.
- `--allow-run`: explicit authorization for reviewed local project scripts.
- `--safe`: restrict fix planning to safe classifications; never expands mutation authority.
- `--base <ref>`: validated Git base reference for a changed-scope audit.
- `--scope`, `--risk`, `--severity`, `--output`: command-specific filters or output location.
- `--check <name>` / `--skip-check <name>`: repeatable planned-check selectors (see below).
- `--url <url>`: address of an application you already started, for runtime evidence.
- `--evidence-dir <dir>`: repository-relative directory for collected runtime evidence.

Unknown flags, platforms, modules, tools, modes, escaping paths, and symlinked destinations fail
closed.

## Exit codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| `0`  | The required command outcome succeeded; advisory Doctor warnings may remain. |
| `1`  | A `FAIL` finding was recorded, or the command itself errored.                |
| `2`  | Nothing failed, but requested evidence could not be collected.               |

Exit `2` is the fail-closed evidence code. An Audit or Verify operation that cannot collect
requested evidence exits `2` rather than `0`: the run proved nothing about what it was asked to
prove. Doctor also exits 2 for required setup evidence, while optional update-lookup warnings remain
visible without making an otherwise healthy local installation unusable.

## Audit orchestration

A normal audit is one coherent operation. It discovers applicable modules, detects candidate project
checks, builds a deterministic planned-check list, executes only what it is explicitly authorized to
execute, and records everything it did not run together with the reason.

```bash
forge all audit
forge all audit --allow-run
forge all audit --allow-run --check lint --check test
forge all audit --allow-run --skip-check build
forge all audit --allow-run --url http://127.0.0.1:3000/
forge all audit --allow-run --url http://127.0.0.1:3000/ --evidence-dir artifacts/ui
```

Under `--json` the audit emits `planned_checks`, `check_outcomes`, `runtime_evidence`, and
`evidence_complete` alongside the report.

**Planned checks.** Every check has a stable identifier: `module:<slug>` for static module
inspection, `command:<script>` for a detected project command, and `runtime:rendered-ui` for
rendered evidence. `--check` and `--skip-check` accept either the full identifier or the bare name,
are repeatable, and reject an unknown value rather than silently ignoring it. The planned list is
ordered deterministically — modules alphabetically, then commands in a fixed order, then runtime
evidence — so two audits of the same checkout produce identical plans.

**Which commands are candidates.** Only these detected scripts are ever eligible: `format:check`,
`lint`, `typecheck`, `test`, `build`, `scan:secrets`, `audit:dependencies`, `check:licenses`. This
is an allowlist, so `start`, `dev`, `serve`, `deploy`, and `publish` are unreachable: an audit never
starts a project server it does not understand.

**Authorization.** Without `--allow-run` no project command and no runtime capture executes; each is
recorded as `NOT_RUN` with cause `unauthorized`. With `--allow-run` the command runs as a bounded
argument vector without a shell, and its exit code, output, timestamp, and duration enter the
execution ledger. A failing authorized command becomes a `FAIL` finding.

**Offline.** Under `--offline` a candidate project command is refused before the process is spawned
unless it is one of the two structurally provable exemptions described in
[the offline command policy](#offline-command-policy), with cause `offline-policy`. Every arbitrary
audited-project script is `UNKNOWN` and is blocked, including one whose definition contains no
network keyword at all: inspecting text can prove that a command reaches the network, but it can
never prove that it does not, and Forge implements no operating-system network isolation. Keyword
matching — `npm audit`, `npx`, `curl`, `git fetch`, and similar — only escalates `UNKNOWN` to
`NETWORK_REQUIRED`; nothing downgrades a command to `OFFLINE_SAFE`. The classification reads the
script body, never its name, and passes through `plannedCheckNetworkPolicy`, the single bridge into
the report vocabulary.

**Runtime evidence.** `--url` integrates rendered-UI capture into the audit; the application must
already be running, because Forge never launches one. Browser tooling is never installed
automatically. Only a `COMPLETE` capture counts: `PARTIAL`, `BLOCKED`, and `FAILED` all leave
`evidence_complete` false, keep the rendered criteria `NOT_VERIFIED`, and exit `2`.

**Not-run records.** Every planned check reaches exactly one terminal outcome. Checks that did not
run become `NOT_VERIFIED` findings carrying `check`, `kind`, `cause`, and `reason`. They are
deliberately not `BLOCKED`: in this schema `BLOCKED` marks an obstructed defect and feeds the fix
pipeline, and an unauthorized check is missing evidence rather than a defect.

## Report mode

Report mode renders an audit that already ran. It never re-runs one, so the rendered document keeps
the identity, revision, timestamps, and evidence of the run it names.

```bash
forge security report                                  # Markdown to stdout
forge security report --json                           # JSON to stdout
forge security report --output artifacts               # writes report.json and report.md
forge security report --output artifacts --dry-run     # prints planned paths, writes nothing
```

`--json` selects the _format_ of what stdout carries; `--output` selects its _subject_. Without
`--output`, stdout carries the report itself, exactly as in earlier releases. With `--output` the
documents go to files and stdout carries the write summary, in JSON when `--json` is also given.

**Ownership policy.** The output directory is resolved beneath the authorized root; traversal,
absolute, drive-qualified, and UNC paths are rejected by construction, and a destination whose path
crosses a symlink or reparse point is refused. Forge records the digest of each file it wrote in a
`.forge-output.json` manifest inside the directory, which yields:

| Directory state                                       | Result                     |
| ----------------------------------------------------- | -------------------------- |
| No manifest, no report files                          | Created, Forge owns them   |
| No manifest, report files already present             | Refused as unowned         |
| Manifest present, file unchanged since Forge wrote it | Overwritten                |
| Manifest present, file edited after Forge wrote it    | Refused; the edit survives |
| Manifest present, new content identical               | Preserved, not rewritten   |

A refusal is an error, not a skip, so `--output` can never appear to succeed while leaving stale
content behind.

## The `--offline` contract

`--offline` changes behavior; it is never silently ignored. Under `--offline` Fullstack Forge:

- refuses HTTP and HTTPS requests to any non-loopback destination, before DNS resolution is
  attempted, so a blocked remote URL produces no network side effect at all;
- refuses to resolve a browser driver from the audited project, because resolution can trigger
  installation or a registry lookup;
- reports every network-dependent check as `BLOCKED`, and the criteria it would have covered as
  `NOT_VERIFIED` — never as `PASS`;
- records `offline: true` in the report environment ledger and in rendered-evidence manifests;
- refuses to execute audited-project scripts whose network behavior is `UNKNOWN`, in
  `forge tool run-project-command` and in every `forge ship` gate alike.

### Offline command policy

Fullstack Forge implements no operating-system network isolation. There is no namespace, seccomp,
firewall, or container boundary in this tool, so it never claims a script was "sandboxed" and never
claims an arbitrary project script is offline-safe. Under `--offline` each detected command is
classified from its **definition**, never its name:

| Policy                        | Meaning                                                                                                                                        | Offline   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `UNKNOWN`                     | Any arbitrary audited-project script.                                                                                                          | Blocked   |
| `forge-internal-offline-safe` | A Fullstack Forge repository script matched by exact definition, only when the audited root is canonically the Forge package root.             | Permitted |
| `cache-only-installation`     | An installation check combining an offline package-manager flag with an unreachable registry, so a remaining network requirement fails loudly. | Permitted |

Every command produces a ledger record — `RAN`, `BLOCKED`, or `NOT_RUN` — with the reason, the
policy, and `sandbox: none`. A blocked command yields no execution record and no typed gate
evidence, so `forge ship --offline --allow-run` reports `BLOCKED` (exit code 2) rather than passing
a gate it never executed. Re-run without `--offline` to execute such a command, and record that the
result was obtained with network access.

Offline mode remains fully compatible with static analysis, local report generation, local
verification, installation from bundled assets, and loopback UI inspection when a trusted browser
driver is already available locally.

## Browser-driver trust

Importing a package executes its top-level code, so importing browser tooling from an audited
repository would run that repository's code inside the auditor's process. Fullstack Forge therefore:

- prefers a Fullstack Forge-owned driver resolved from the tool's own package root;
- never imports the audited project's driver by default;
- uses the audited project's driver only under explicit `--allow-run`, only after the resolved real
  path is proven to lie inside the audited repository (defeating symlink and path-escape
  redirection), and never under `--offline`;
- records the resolved package, version, real path, trust domain, and whether it was trusted in the
  evidence manifest;
- resolves, imports, and launches nothing at all under `--dry-run`.

## Rendered-evidence layout

Rendered-UI evidence is written per revision, per run, and per route so no capture overwrites
another:

The base directory defaults to `.forge/evidence/ui` and is relocated by `--evidence-dir`, which is
resolved beneath the audited root; absolute and traversing values are refused.

```text
<evidence-dir>/<revision>/<run-id>/<route-id>/
  desktop-1280x800.png
  tablet-768x1024.png
  mobile-375x812.png
  console.json
  manifest.json
```

The route identifier combines a sanitized single path segment with a hash of the normalized URL, so
query strings, fragments, and traversal sequences cannot influence the directory layout. URL
credentials are rejected outright, and query values are redacted to `[REDACTED]` in every artifact.
The manifest records the revision, timestamp, redacted source and final URL, redirect state,
viewport dimensions, driver identity, per-screenshot SHA-256 hashes, the console-output hash,
authorization state, offline state, and any limitations from a partial capture.

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

Every run reports a `capture_status`:

```text
COMPLETE  every required viewport captured and hashed, nothing blocked
PARTIAL   some evidence collected, but a required step failed or was blocked
BLOCKED   a policy boundary (authorization, offline, no trusted driver) prevented execution
FAILED    execution was attempted but produced no usable capture
```

Only `COMPLETE` with zero console errors yields the informational `FF-UI-RENDER-001` `PASS`. Any
other status produces `FF-UI-CAPTURE-001` and leaves the rendered criteria `NOT_VERIFIED`; partial
evidence is still written. Exit codes are `0` for a complete capture with no failing finding, `1`
for a run with a failing finding or a runtime failure, and `2` when evidence is merely absent.

Under `--offline` the tool intercepts every browser request and aborts non-loopback destinations
before they are sent, including redirects and subresources. Blocked destinations are recorded with
their URLs redacted, and a blocked resource prevents a `COMPLETE` capture. All console output,
errors, and URLs in the evidence are redacted before they reach `console.json`, `manifest.json`,
findings, limitations, or CLI output.
