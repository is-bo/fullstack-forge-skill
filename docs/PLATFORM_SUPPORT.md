# Platform support

Fullstack Forge installs independent files with no symlinks. Project installation uses each host's
existing skill discovery path plus its supported instruction mechanism.

| Selector                       | Product                                          | Project skills      | Managed automatic instruction                          |
| ------------------------------ | ------------------------------------------------ | ------------------- | ------------------------------------------------------ |
| `codex` / `agents` / `generic` | Codex, generic Agent Skills, Antigravity project | `.agents/skills/`   | `AGENTS.md` section                                    |
| `claude`                       | Claude Code                                      | `.claude/skills/`   | `CLAUDE.md` section                                    |
| `gemini`                       | Gemini CLI                                       | `.gemini/skills/`   | `GEMINI.md` section                                    |
| `cursor`                       | Cursor                                           | `.cursor/skills/`   | `.cursor/rules/fullstack-forge.mdc`                    |
| `windsurf`                     | Windsurf                                         | `.windsurf/skills/` | `.windsurf/rules/fullstack-forge.md`                   |
| `github`                       | GitHub Copilot                                   | `.github/skills/`   | `.github/instructions/fullstack-forge.instructions.md` |

Antigravity's verified project skill destination is `.agents/skills/`; its user skill destination is
`$HOME/.gemini/config/skills/`. Gemini CLI uses `$HOME/.gemini/skills/`. Global installs do not
write project instructions.

Root instruction files use marked sections so user-authored content is preserved. Dedicated Cursor,
Windsurf, and Copilot instruction files are fully Forge-owned. The manifest records the management
mode and digest. Update refuses modified owned content; uninstall removes only unchanged owned
content.

Explicit skill selection remains supported on every host, but automatic project instructions mean
normal engineering requests do not need `$forge`, a slash command, or an `@` mention.

## Optional explicit selection

The installed skill is named `forge`. Host-native selection is not universal command syntax:

| Host                           | Repository-supported explicit form                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Codex and generic Agent Skills | `$forge audit security` where `$skill` selection is available                            |
| Antigravity                    | Select the installed `forge` skill in the manager surface, then request `audit security` |
| Claude Code                    | `/forge audit security`                                                                  |
| Gemini CLI                     | Open `/skills`, select `forge`, then request `audit security`                            |
| Cursor                         | `/forge audit security` from the skill/slash menu                                        |
| Windsurf / Devin Cascade       | `@forge audit security`                                                                  |
| GitHub Copilot                 | Ask Copilot to use the installed `forge` skill; no universal slash form is asserted      |

The stable executable equivalent on every host is `npx forge audit security`. Generated and
installation tests verify skill files and managed instructions; they do not prove a live host UI
accepted a command. Platform UIs can change, so unlaunched host interaction remains `NOT_VERIFIED`.

The managed instruction explicitly routes interface requests to `forge-frontend`, adds `forge-ui`
for visual decisions and `forge-ux` for journeys, and composes accessibility for every human-facing
change. It also tells hosts not to load mobile, dashboard, chart, motion, or framework references
without matching evidence. Update and uninstall retain the same digest and ownership safeguards for
this expanded activation text.

Platform UIs and discovery behavior can change. Release verification distinguishes generated and
installation tests from live host UI tests.
