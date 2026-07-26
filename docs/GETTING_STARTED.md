# Get started with Fullstack Forge

Fullstack Forge helps an AI coding agent build and verify production-ready applications without
treating missing evidence as success.

## Install the full product

Node.js 24 or newer and Git are required. Install the versioned package, then copy its skills into
the supported agent directories in this project:

```bash
npm install --save-dev github:thethunderbolt/fullstack-forge-skill#v0.5.2
npx forge init
npx forge doctor
```

With no selector, Forge keeps the broad compatible install while detecting finite existing agent
configuration markers and executable-name hints, then recommending a narrower selector when direct
evidence exists. Detection never runs an executable and cannot block the install. The installer
copies regular files, atomically records ownership in `.fullstack-forge/install-manifest.json`
before new managed paths are written, resumes safely after interruption, refuses destination links,
and does not overwrite changed or unowned files.

For agent skills without the persistent CLI dependency, the verified third-party alternative is:

```bash
npx --yes --package skills@1.5.20 skills add thethunderbolt/fullstack-forge-skill --copy --skill '*'
```

Choose your agent when prompted. Add `--agent codex --yes` for an unattended Codex project install.
`--copy` is important: it requests real files instead of links. This route installs skills only; use
the first-party npm route when you want the persistent `forge` executable, ownership-aware updates,
`forge doctor`, or uninstall protection.

## Run your first command

```bash
npx forge
```

An interactive terminal shows a menu. A script or redirected terminal receives the same choices as a
numbered list and exits successfully.

```bash
npx forge build "add customer login"
npx forge audit
npx forge status
```

In an agent chat, use `/forge build ...` where slash skills are supported. In Codex:

1. Open the skill picker.
2. Select **Forge**.
3. Choose an action from the displayed menu or describe the task normally.

The picker preview reads **Build · Audit · Fix · Verify · Ship · Status**. Selecting Forge with no
action shows Build, Continue, Audit changed work, Audit the whole project, preview and apply-safe
Fix, Verify, Ship, Status, and Help choices without running a check or creating state.

Examples:

```text
$forge build secure customer login
$forge audit all
$forge audit authentication
$forge fix
$forge verify
$forge ship
```

Codex does not expose these actions as separate nested picker commands. The single Forge skill is
the visible product entrance and routes plain language to the internal Build, Audit, Fix, Verify,
Ship, Status, and Help workflows. The advanced **Fullstack Forge — Expert Audit** skill and all
specialist `$forge-<area>` skills remain available.

## Understand the result

The terminal gives a short explanation, the most important actions, safe-fix availability, and the
next command. Full evidence remains in `.forge/report.md`; stable automation data remains in
`.forge/report.json`. Use `--details` to print the technical report or `--json` for machine output.
Discovery is Git-aware and bounded; see [Repository inventory](REPOSITORY_INVENTORY.md) for
`.forgeignore`, repeatable `--exclude`, budget diagnostics, and exit code `2`.

Continue with [Build your first feature](BUILD_YOUR_FIRST_FEATURE.md),
[Audit your application](AUDIT_YOUR_APPLICATION.md), or [Troubleshooting](TROUBLESHOOTING.md).
