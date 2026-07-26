# Platform support

Verified 2026-07-25 against primary platform documentation. Fullstack Forge emits independent file
copies; it never depends on symlinks.

| Selector      | Product                  | Project path                           | User path                                          | Invocation / notes                                                                                          |
| ------------- | ------------------------ | -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `codex`       | OpenAI Codex             | `.agents/skills/`                      | `$HOME/.agents/skills/`                            | Select `$forge` for the beginner menu; `$fullstack-forge` remains the expert audit entry.                   |
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

## Product and Build command skills

The simple `forge` router plus `forge-new` and `forge-feature` are generated and synchronized
alongside the 42 audit command skills, so all 46 skills ship to every platform root. Use
`/forge ...` where named skills become slash commands; use `$forge ...` or explicit skill selection
in Codex. Expert `/forge-new`, `/forge-feature <slug>`, `$forge-new`, and `$forge-feature <slug>`
forms remain available. See [BUILD_MODE.md](BUILD_MODE.md).

Codex reads the router's `agents/openai.yaml` and shows **Forge** with the preview **Build · Audit ·
Fix · Verify · Ship · Status**. Select it and choose from the beginner menu or describe the task
normally. Codex does not create a nested native picker command for each Forge action. The separate
**Fullstack Forge — Expert Audit** picker entry preserves backward-compatible advanced
orchestration. Restart Codex if freshly installed metadata does not appear.

All platform archives carry the same compiled CLI contracts: schema-v2 Build state, registered
producers, applicability/gate re-derivation, the runtime evidence matrix, and explicit
`forge migrate build`, plus bounded Git-aware repository inventory. Migration is a CLI command
rather than an Agent Skill entry point; no host may silently reinterpret v0.2 state or manufacture a
Build result when the CLI is absent.

## Primary sources

- Agent Skills specification: <https://agentskills.io/specification>
- OpenAI Codex manual: <https://developers.openai.com/codex/codex-manual.md>
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
