# Troubleshooting Fullstack Forge

## Start with doctor

```bash
npx forge doctor
```

Doctor exits `0` when required local checks pass, `1` for a broken or changed installation, and `2`
when setup is incomplete or evidence cannot be established. Each non-passing check includes an exact
next action. Update lookup is a non-passing warning rather than a false pass when `--offline` is set
or the fixed upstream tag endpoint is unavailable.

## Forge is not installed for my agent

```bash
npx forge init all --dry-run
npx forge init all
npx forge doctor
```

Use a specific selector (`codex`, `claude`, `cursor`, `gemini`, `antigravity`, `windsurf`, `github`,
or `generic`) instead of `all` if desired. Add `--global` only when you intentionally want a
user-level installation.

## Codex does not show the Forge preview

Run `npx forge doctor`, confirm the `codex` or `all` selector installed
`.agents/skills/forge/agents/openai.yaml`, then restart Codex. The expected entry is **Forge** with
the preview **Build · Audit · Fix · Verify · Ship · Status**. **Fullstack Forge — Expert Audit** is
the separate advanced audit entry.

Codex does not expose `build`, `audit`, or the other actions as nested native slash commands. Select
Forge once, then choose from its menu or write a plain-language request such as
`$forge audit authentication`.

## Install or update refuses a file

Forge does not overwrite unowned files or files changed since its ownership manifest was written.
Keep the file, compare it with the generated source, and choose the intended content manually. Do
not delete the ownership manifest to force an overwrite.

## Installation was interrupted

Run the ownership-aware update again:

```bash
npx forge update all
npx forge doctor
```

Forge records ownership for new managed paths before writing their contents and replaces files
atomically. A retry can therefore recreate missing owned files or finish an interrupted update
without adopting pre-existing identical files. If Doctor reports changed files rather than missing
files, review them first; Forge will not overwrite them.

## A report says blocked or not verified

Read the named missing evidence in `.forge/report.md`. Common causes are a missing browser driver,
an unreachable application, an unsupported stack shape, a project command that was not authorized,
or evidence from an older revision. Do not translate this state into success.

## The command is unknown

Run `npx forge help`. Common misspellings receive a suggestion but never execute automatically. Use
`npx forge help advanced` for the complete legacy and expert grammar.

If the shell rejects `froge`/`forget` or an agent host rejects `/froge` before any Forge output,
Forge was never invoked and cannot supply its own suggestion. Correct the entry point to `forge` or
`/forge`; once Forge is running, misspelled subcommands such as `autdit` and `biuld` receive bounded
suggestions without executing.

## Build state is stale or interrupted

Run `npx forge status`, then `npx forge continue`. Schema-v1 state from v0.2 must use the explicit
`npx forge migrate build --dry-run` and reviewed migration workflow. Corrupt or mixed state is
refused rather than guessed.

## Wrong directory

Run Forge from the repository root or pass `--root <path>`. Forge confines state, reports, fixes,
and installation destinations to the selected canonical root and rejects unsafe links or traversal.
