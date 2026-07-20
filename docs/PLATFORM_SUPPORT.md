# Platform support

Verified 2026-07-18 against primary platform documentation. Fullstack Forge emits independent file
copies; it never depends on symlinks.

| Selector      | Product                  | Project path                           | User path                                          | Invocation / notes                                                                                          |
| ------------- | ------------------------ | -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `codex`       | OpenAI Codex             | `.agents/skills/`                      | `$HOME/.agents/skills/`                            | `$fullstack-forge`; current Codex scans `.agents/skills` from the working directory to repository root.     |
| `claude`      | Claude Code              | `.claude/skills/`                      | `$HOME/.claude/skills/`                            | `/fullstack-forge`; `.claude/commands` is legacy.                                                           |
| `antigravity` | Google Antigravity       | `<project>/.agents/skills/`            | `$HOME/.gemini/config/skills/`                     | Project and user destinations are distinct. The user destination is not a generic-agent alias.              |
| `gemini`      | Gemini CLI               | `.gemini/skills/` or `.agents/skills/` | `$HOME/.gemini/skills/` or `$HOME/.agents/skills/` | Use `/skills list` or `/skills reload`; Fullstack Forge selects the product-specific `.gemini` destination. |
| `cursor`      | Cursor                   | `.cursor/skills/`                      | `$HOME/.cursor/skills/`                            | Slash-menu invocation; Cursor also documents `.agents/skills`.                                              |
| `windsurf`    | Windsurf / Devin Cascade | `.windsurf/skills/`                    | `$HOME/.codeium/windsurf/skills/`                  | `@fullstack-forge`; Cascade also scans `.agents/skills`.                                                    |
| `github`      | GitHub Copilot           | `.github/skills/`                      | `$HOME/.copilot/skills/`                           | Automatic or named selection; compatible repository aliases are also accepted.                              |
| `generic`     | Generic Agent Skills     | `.agents/skills/`                      | `$HOME/.agents/skills/`                            | Invocation depends on host.                                                                                 |

`agents`, `codex`, and `generic` select the generic `.agents/skills` destination. Antigravity uses
the same project directory but a separate user destination. `forge init all` deduplicates identical
project destinations while preserving distinct global destinations.

## Build mode command skills

`forge-new` and `forge-feature` are generated and synchronized alongside the 42 audit command
skills, so they ship to all six platform roots above with the same invocation conventions as
`fullstack-forge` and every `forge-<section>` skill — for example `/forge-new` and
`/forge-feature <slug>` on Claude Code, `$forge-new` and `$forge-feature <slug>` on Codex. See
[BUILD_MODE.md](BUILD_MODE.md).

## Primary sources

- Agent Skills specification: <https://agentskills.io/specification>
- OpenAI Codex skills: <https://learn.chatgpt.com/docs/build-skills.md>
- Claude Code skills and slash commands: <https://code.claude.com/docs/en/slash-commands>
- Gemini CLI Agent Skills: <https://geminicli.com/docs/cli/using-agent-skills/>
- Antigravity getting started:
  <https://codelabs.developers.google.com/getting-started-google-antigravity>
- Antigravity skill authoring:
  <https://codelabs.developers.google.com/getting-started-with-antigravity-skills>
- Cursor Agent Skills announcement: <https://cursor.com/changelog/2-4>
- Windsurf/Cascade skills: <https://docs.devin.ai/desktop/cascade/skills>
- GitHub Copilot Agent Skills:
  <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>

Platform behavior changes over time. Treat these paths as versioned interoperability claims and
re-verify before changing a generator or installer target. The Antigravity skill-authoring codelab
also contains a later aside with older, conflicting path names (`.agent/skills` and
`~/.gemini/antigravity-cli/skills`). Fullstack Forge follows the codelab's installation section and
the current product distinction above, and records the ambiguity rather than silently conflating
Antigravity with Gemini CLI.
