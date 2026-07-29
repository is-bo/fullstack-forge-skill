# Cloudflare Skills

Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is
a pristine copy of the selected upstream files: Forge never edits it in place. Runtime
adaptations are applied by the composition compiler from declared overlays and transforms.

| Field | Value |
| --- | --- |
| Repository | `cloudflare/skills` |
| Upstream commit | `30553f89ae1ef1e3c2917cd09d72dac992bb4e9a` |
| Upstream tag | _none — pinned default-branch head_ |
| Licence | Apache-2.0 |
| Licence evidence | `LICENSE` |
| Files imported | 349 |
| Content checksum | `3f21a2a8efe98f1f1229540588578823170f7d0c52afee4c75935e1422c49abb` |
| Update policy | reviewed-only |

## Selected paths

- `LICENSE`
- `commands/build-agent.md`
- `commands/build-mcp.md`
- `skills/agents-sdk/`
- `skills/cloudflare/`
- `skills/durable-objects/`
- `skills/web-perf/`
- `skills/wrangler/`

## Import notes

`building-mcp-server-on-cloudflare` and `building-ai-agent-on-cloudflare` are published as the command files `commands/build-mcp.md` and `commands/build-agent.md`, not as skills; they are imported as references, never as user-facing Forge commands.

## Instruction review

The automated screen recorded the hits below. Each was reviewed against Forge's approval boundaries; guidance that merely *describes* an operation is advisory, and no vendored instruction can bypass a Forge contract at runtime.

- `global-install` — `skills/cloudflare/references/cron-triggers/gotchas.md`: 4. Update Wrangler if outdated: ```bash npm install -g wrangler@latest ``` ### "waitUntil() Tasks Not Completing" **Pr
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloudflare/references/cron-triggers/gotchas.md`: 4. Update Wrangler if outdated: ```bash npm install -g wrangler@latest ``` ### "waitUntil() Tasks Not Completing" **Pr
- `global-install` — `skills/cloudflare/references/sandbox/configuration.md`: docker.io/cloudflare/sandbox:0.7.0 RUN npm install -g typescript ts-node ``` **CRITICAL**: `EXPOSE` required for `wran
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloudflare/references/sandbox/configuration.md`: docker.io/cloudflare/sandbox:0.7.0 RUN npm install -g typescript ts-node ``` **CRITICAL**: `EXPOSE` required for `wran
- `global-install` — `skills/cloudflare/references/sandbox/patterns.md`: docker.io/cloudflare/sandbox:0.7.0 RUN npm install -g ws EXPOSE 8080 ``` ## Process Readiness Pattern ```typescript e
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloudflare/references/sandbox/patterns.md`: docker.io/cloudflare/sandbox:0.7.0 RUN npm install -g ws EXPOSE 8080 ``` ## Process Readiness Pattern ```typescript e
- `remote-exec` **(hard-deny rule)** — `skills/cloudflare/references/sandbox/patterns.md`: ('/start')) { await sandbox.exec('curl -fsSL https://code-server.dev/install.sh | sh'); await sandbox.startP
- `global-install` — `skills/cloudflare/references/wrangler/README.md`: stall wrangler --save-dev # or globally npm install -g wrangler ``` Run commands: `npx wrangler <command>` (or `pnpm`/`
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloudflare/references/wrangler/README.md`: stall wrangler --save-dev # or globally npm install -g wrangler ``` Run commands: `npx wrangler <command>` (or `pnpm`/`

## Attribution

No explicit upstream copyright notice was published. Licensed under Apache-2.0.
The upstream maintainers do not endorse Fullstack Forge.
