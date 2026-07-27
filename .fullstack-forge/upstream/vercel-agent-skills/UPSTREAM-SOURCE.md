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
| Files imported | 194 |
| Content checksum | `3c3b2a3fbfb3510e2d64a7e412c6b94421b3193a8ebae6e882f17a6fd82764c6` |
| Update policy | reviewed-only |

## Selected paths

- `README.md`
- `skills/react-best-practices/`
- `skills/react-native-skills/`
- `skills/react-view-transitions/`
- `skills/vercel-optimize/`
- `skills/web-design-guidelines/`

## Excluded paths

- `**/lib/`
- `**/scripts/`
- `**/tests/`

## Import notes

The repository has no LICENSE file at the pinned commit; MIT is declared in README.md and in each selected SKILL.md frontmatter (`license: MIT`). Both are recorded verbatim in SOURCE.md as the licence evidence. `writing-guidelines`, `deploy-to-vercel`, and `vercel-cli-with-tokens` are excluded: Forge does not adopt a house writing style and does not import autonomous deployment.

## Instruction review

The automated screen recorded the hits below. Each was reviewed against Forge's approval boundaries; guidance that merely *describes* an operation is advisory, and no vendored instruction can bypass a Forge contract at runtime.

- `telemetry` **(hard-deny rule)** — `skills/react-best-practices/AGENTS.md`: ese block the main thread immediately analytics.track('search', { query }) saveToRecentSearches(query) prefetchTop
- `telemetry` **(hard-deny rule)** — `skills/react-best-practices/rules/js-request-idle-callback.md`: ese block the main thread immediately analytics.track('search', { query }) saveToRecentSearches(query) prefetchTop
- `global-install` — `skills/vercel-optimize/README.md`: l contract`, and `vercel api` support (`npm i -g vercel@latest`). The skill enforces v53+ as its compatibility floor. -

## Attribution

Copyright (c) Vercel, Inc.. Licensed under MIT.
The upstream maintainers do not endorse Fullstack Forge.
