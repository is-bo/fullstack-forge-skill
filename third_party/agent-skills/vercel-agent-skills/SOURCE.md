# Vercel Agent Skills

Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is
a pristine copy of the selected upstream files: Forge never edits it in place. Runtime
adaptations are applied by the composition compiler from declared overlays and transforms.

| Field | Value |
| --- | --- |
| Repository | `vercel-labs/agent-skills` |
| Upstream commit | `7c180d9044c9ae2b442b567aad4e42a28dd5ed62` |
| Upstream tag | _none — pinned default-branch head_ |
| Licence | MIT |
| Licence evidence | `README.md#license` |
| Files imported | 119 |
| Content checksum | `3e0356036a7cb5a180c85c7495cb63667f6855eca8aa1b10a11d68809364945e` |
| Update policy | reviewed-only |

## Selected paths

- `README.md`
- `skills/react-best-practices/`
- `skills/react-native-skills/`
- `skills/react-view-transitions/`
- `skills/web-design-guidelines/`

## Excluded paths

- `**/lib/`
- `**/scripts/`
- `**/tests/`
- `skills/react-best-practices/AGENTS.md`
- `skills/react-best-practices/README.md`
- `skills/react-best-practices/metadata.json`
- `skills/react-native-skills/AGENTS.md`
- `skills/react-native-skills/README.md`
- `skills/react-native-skills/metadata.json`
- `skills/react-view-transitions/AGENTS.md`
- `skills/react-view-transitions/README.md`
- `skills/react-view-transitions/metadata.json`

## Import notes

The repository has no LICENSE file at the pinned commit; MIT is declared in README.md and in each selected SKILL.md frontmatter (`license: MIT`). Both are recorded verbatim in SOURCE.md as the licence evidence. `writing-guidelines`, `deploy-to-vercel`, and `vercel-cli-with-tokens` are excluded: Forge does not adopt a house writing style and does not import autonomous deployment.

## Instruction review

The automated screen recorded the hits below. Each was reviewed against Forge's approval boundaries; guidance that merely *describes* an operation is advisory, and no vendored instruction can bypass a Forge contract at runtime.

- `foreign-skill-install` **(hard-deny rule)** — `README.md`: ?code=... ``` ## Installation ```bash npx skills add vercel-labs/agent-skills ``` ## Usage Skills are automatically
- `telemetry` **(hard-deny rule)** — `skills/react-best-practices/rules/js-request-idle-callback.md`: ese block the main thread immediately analytics.track('search', { query }) saveToRecentSearches(query) prefetchTop
- `telemetry` **(hard-deny rule)** — `skills/react-best-practices/rules/js-request-idle-callback.md`: riods requestIdleCallback(() => { analytics.track('search', { query }) }) requestIdleCallback(() => { sav
- `telemetry` **(hard-deny rule)** — `skills/react-best-practices/rules/js-request-idle-callback.md`: stays busy requestIdleCallback( () => analytics.track('page_view', { path: location.pathname }), { timeout: 2000 } )

## Attribution

No explicit upstream copyright notice was published. Licensed under MIT.
The upstream maintainers do not endorse Fullstack Forge.
