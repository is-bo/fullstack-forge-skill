# Get started with Fullstack Forge

Fullstack Forge helps an AI coding agent build and verify production-ready applications without
treating missing evidence as success.

## Install the full product

Node.js 24 or newer and Git are required. Install the versioned package, then copy its skills into
the supported agent directories in this project:

```bash
npm install --save-dev github:thethunderbolt/fullstack-forge-skill#v0.4.0
npx forge init all
npx forge doctor
```

The installer copies regular files, records ownership in `.fullstack-forge/install-manifest.json`,
refuses destination links, and does not overwrite changed or unowned files.

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

In an agent chat, use `/forge build ...` where slash skills are supported. In Codex, select the
`forge` skill with `$forge` or the skill picker and write the same request.

## Understand the result

The terminal gives a short explanation, the most important actions, safe-fix availability, and the
next command. Full evidence remains in `.forge/report.md`; stable automation data remains in
`.forge/report.json`. Use `--details` to print the technical report or `--json` for machine output.

Continue with [Build your first feature](BUILD_YOUR_FIRST_FEATURE.md),
[Audit your application](AUDIT_YOUR_APPLICATION.md), or [Troubleshooting](TROUBLESHOOTING.md).
