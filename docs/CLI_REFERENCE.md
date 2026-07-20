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

Both forms evaluate the explicit internal, typed audit-evidence, capability, and project-native gate
registry. Secret, dependency, lockfile, license, authorization, tenant, upload, migration, test, and
release-artifact evidence is revision- and timestamp-bound and cannot satisfy another gate by broad
section membership. Without `--allow-run`, an applicable project-defined command is `BLOCKED`; after
review, the flag executes its bounded argument vector without a shell. A missing recognized command
cannot produce a pass by omission. The command records exit code, output, and duration and stops
after the first failure. Remote CI, GitHub release, registry, deployment, and production state still
require separate direct evidence.

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
- `--offline`: enforce the offline contract (see below); it is not advisory.
- `--allow-run`: explicit authorization for reviewed local project scripts.
- `--safe`: restrict fix planning to safe classifications; never expands mutation authority.
- `--base <ref>`: validated Git base reference for a changed-scope audit.
- `--scope`, `--risk`, `--severity`, `--output`: command-specific filters or output location.

Unknown flags, platforms, modules, tools, modes, escaping paths, and symlinked destinations fail
closed.

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

```text
.forge/evidence/ui/<revision>/<run-id>/<route-id>/
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
