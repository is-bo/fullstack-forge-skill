# Fullstack Forge v0.5 product-layer design

## Product decision

Keep the v0.4 simple entrance and trusted Build/Audit engines intact. v0.5 closes evidence,
installation-resilience, and onboarding gaps without adding a second implementation of any audit,
fix, verification, or release gate.

The default is safe progressive disclosure:

1. one plain-language command;
2. a concise outcome and next action;
3. a complete Markdown report when a human needs detail; and
4. stable JSON for automation.

Expert commands, report/finding identity, Build state, module names, and approval boundaries remain
compatible.

## Simple command mapping

| Simple command                  | Trusted internal mapping                                                                         | Fail-closed behavior                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `forge build`                   | `forge new` if project state is absent; otherwise resume or request a feature                    | Framing records user intent but never counts as implementation evidence.                           |
| `forge build <request>`         | redact request, derive safe slug, then `forge feature <slug> --summary <request>`                | Reserved/colliding IDs are handled deterministically; secrets are not persisted.                   |
| `forge continue`                | load and revalidate Build state, then resume the only unfinished feature                         | Several unfinished features produce an explicit choice list; Forge never guesses.                  |
| `forge audit`                   | `forge all audit --scope changed` when the Git base is reliable, otherwise full applicable scope | The selected scope is stated before the audit.                                                     |
| `forge audit all`               | `forge all audit --scope full`                                                                   | Every module receives a recorded applicability/selection decision.                                 |
| `forge audit <area>`            | closed natural-language aliases to one module                                                    | Unknown or intrinsically ambiguous phrases are rejected with bounded choices.                      |
| `forge audit <area> and <area>` | explicit finite module set through the existing Audit orchestrator                               | Every conjunct must resolve independently; no broad semantic guess is allowed.                     |
| `forge fix [area]`              | existing fix registry for one module or all modules                                              | Preview is the default; only `--safe` writes, and post-write analyzers must pass or rollback runs. |
| `forge verify [area]`           | existing finding-specific Verify engine                                                          | FAIL exits 1; BLOCKED or NOT_VERIFIED exits 2; stale findings not directly rechecked are demoted.  |
| `forge ship`                    | independent Ship re-derivation                                                                   | Build state and saved report claims are diagnostics only.                                          |
| `forge status`                  | read install, Build, report, and release-decision state                                          | Status never creates evidence or claims release readiness.                                         |
| `forge help`                    | simple-first reference                                                                           | `forge help advanced` retains the complete grammar.                                                |
| `forge`                         | TTY menu or noninteractive numbered list                                                         | Keyboard-only, cancellable, optional, and script-safe.                                             |

## Installation and recovery design

`forge init` keeps `all` as the compatibility default. Before writing, it reads known project/user
configuration markers and checks a finite list of executable filenames on absolute `PATH` entries
without running them. Each result is labelled as a hint, not proof that an agent host is installed
or running. A failed optional detection produces a warning and cannot block installation.

Every install is fully preflighted before managed writes. For new paths, Forge atomically records
their ownership and expected hashes before creating content. Updates keep the old manifest hash
until the replacement file has been atomically renamed. Therefore, after interruption:

- a missing owned file is safely recreated;
- an already-written new version is accepted only when it matches the current bundled hash;
- a pre-existing identical unowned file remains unowned;
- a changed file is refused and preserved; and
- `forge update all` is the repair/resume command.

The success message confirms version, scope, agents, skill count, and file actions, then shows
Build, Audit, Help, and Doctor entry points.

## Doctor model

Doctor separates broken required checks from advisory warnings:

- exit 1: a runtime, bundle, generated copy, ownership, or integrity check failed;
- exit 2: required setup/evidence is incomplete;
- exit 0: required local checks pass, with any advisory warning still printed explicitly.

The update check uses a fixed upstream Git URL, a shell-free argument vector, a ten-second timeout,
stable-semver allowlisting, secret redaction, and bounded diagnostic output. A newer release is a
warning with exact package and skill-update commands. Offline or unavailable lookup is also a
warning, never a false `PASS`.

## Evidence and revision behavior

Verify compares the prior report revision with the current working-tree revision. It may bind a
finding to the new revision only when the finding-specific action ran against that revision.
Otherwise the prior status is retained as diagnostic text and the current status becomes
`NOT_VERIFIED`. This applies to positive findings with no executable plan and to findings outside a
section-specific Verify.

Status precedence remains:

```text
FAIL > BLOCKED > NOT_VERIFIED > WARNING > PASS > NOT_APPLICABLE
```

No simple renderer changes that status. Concise output points to the same complete report and JSON
that expert commands use.

## Compatibility boundaries

- Existing command forms continue to parse and route unchanged.
- Report schema v2, finding IDs/instances, Build schema v2, and ownership manifest schema v1 remain
  unchanged.
- No new project command runs without `--allow-run`.
- No destination symlink is followed and no unowned/modified file is overwritten.
- Slash-command typo recovery is limited by the host: Forge can suggest only after the host or shell
  actually invokes Forge.
- Generated platform formats are tested structurally; vendor host UI execution is separate external
  evidence.
