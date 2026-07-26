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

The managed instruction explicitly routes interface requests to `forge-frontend`, adds `forge-ui`
for visual decisions and `forge-ux` for journeys, and composes accessibility for every human-facing
change. It also tells hosts not to load mobile, dashboard, chart, motion, or framework references
without matching evidence. Update and uninstall retain the same digest and ownership safeguards for
this expanded activation text.

Platform UIs and discovery behavior can change. Release verification distinguishes generated and
installation tests from live host UI tests; an unlaunched host remains unverified.
