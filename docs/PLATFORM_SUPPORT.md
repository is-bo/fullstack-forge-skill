# Platform support

Verified 2026-07-18 against primary platform documentation. Fullstack Forge emits independent file
copies; it never depends on symlinks.

| Selector      | Product                  | Project path        | User path                           | Invocation / notes                                                                                                              |
| ------------- | ------------------------ | ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `codex`       | OpenAI Codex             | `.agents/skills/`   | `$HOME/.agents/skills/`             | `$fullstack-forge`; current Codex scans `.agents/skills` from the working directory to repository root.                         |
| `claude`      | Claude Code              | `.claude/skills/`   | `$HOME/.claude/skills/`             | `/fullstack-forge`; `.claude/commands` is legacy.                                                                               |
| `antigravity` | Google Antigravity CLI   | `.agents/skills/`   | product-specific global path varies | Current Antigravity CLI guidance uses open Agent Skills under `.agents/skills`; older IDE guidance may mention `.agent/skills`. |
| `gemini`      | Gemini CLI               | `.gemini/skills/`   | `$HOME/.gemini/skills/`             | Use `/skills list` or `/skills reload`; Gemini also recognizes `.agents/skills` as an alias.                                    |
| `cursor`      | Cursor                   | `.cursor/skills/`   | `$HOME/.cursor/skills/`             | Slash-menu invocation; Cursor also documents `.agents/skills`.                                                                  |
| `windsurf`    | Windsurf / Devin Cascade | `.windsurf/skills/` | `$HOME/.codeium/windsurf/skills/`   | `@fullstack-forge`; Cascade also scans `.agents/skills`.                                                                        |
| `github`      | GitHub Copilot           | `.github/skills/`   | `$HOME/.copilot/skills/`            | Automatic or named selection; `.agents/skills` and `.claude/skills` are also accepted in repositories.                          |
| `generic`     | Open Agent Skills        | `.agents/skills/`   | `$HOME/.agents/skills/`             | Invocation depends on host.                                                                                                     |

`agents`, `codex`, `antigravity`, and `generic` are aliases for one underlying copy target.
`forge init all` deduplicates it.

## Primary sources

- Agent Skills specification: <https://agentskills.io/specification>
- OpenAI Codex skills: <https://learn.chatgpt.com/docs/build-skills.md>
- Claude Code skills and slash commands: <https://code.claude.com/docs/en/slash-commands>
- Gemini CLI skills: <https://geminicli.com/docs/cli/tutorials/skills-getting-started/>
- Antigravity CLI skills:
  <https://codelabs.developers.google.com/antigravity/how-to-create-agent-skills-for-antigravity-cli>
- Cursor Agent Skills announcement: <https://cursor.com/changelog/2-4>
- Windsurf/Cascade skills: <https://docs.devin.ai/desktop/cascade/skills>
- GitHub Copilot Agent Skills:
  <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>

Platform behavior changes over time. Treat these paths as versioned interoperability claims and
re-verify before changing a generator or installer target.
