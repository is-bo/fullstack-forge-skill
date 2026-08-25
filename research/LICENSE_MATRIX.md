# License matrix

This matrix has two deliberately separate scopes. The current release's copied upstream material is
the allowlisted, checksummed set in `config/upstream-providers.json`, with one `SOURCE.md` and one
notice entry per provider. The conceptual rows below describe research that was not vendored unless
the current-import table says otherwise. “Concept only” means ideas and interoperability facts were
learned, while implementation and prose were independently authored.

## Current allowlisted upstream imports

These are the only external repositories whose selected files are distributed in the candidate
package. The exact path allowlist, exclusions, transforms, and review status live in the registry
and the linked `third_party/agent-skills/*/SOURCE.md` records; this table is a human-readable index.

| Provider                                                                           | Pinned revision                                                     | License evidence                                                          | Shipped scope                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impeccable — `third_party/agent-skills/impeccable/SOURCE.md`                       | `pbakaus/impeccable@fc2e694afca1ac0cc384b4fe56bab3335fea7912`       | Apache-2.0 `LICENSE`                                                      | Selected `.claude/skills/impeccable` guidance and notice files; executable detector/live tooling excluded                                          |
| Addy Osmani Agent Skills — `third_party/agent-skills/addy-agent-skills/SOURCE.md`  | `addyosmani/agent-skills@ff2df4c07e7836a092ed28e1e9b42f4d6009280c`  | MIT `LICENSE`                                                             | Reviewed skill/reference directories; scripts and global routing excluded                                                                          |
| Vercel Agent Skills — `third_party/agent-skills/vercel-agent-skills/SOURCE.md`     | `vercel-labs/agent-skills@7c180d9044c9ae2b442b567aad4e42a28dd5ed62` | MIT in `README.md#license` and selected skill metadata; no root `LICENSE` | Selected React, React Native, view-transition, and web-guideline files; deployment/writing/tooling paths excluded; manual evidence review required |
| Supabase Agent Skills — `third_party/agent-skills/supabase-agent-skills/SOURCE.md` | `supabase/agent-skills@1ad9aaeb49caafd9e95c0a91116f71890eebbc53`    | MIT `LICENSE`                                                             | Selected Supabase and Postgres guidance                                                                                                            |
| Google Skills — `third_party/agent-skills/google-skills/SOURCE.md`                 | `google/skills@d1c9be2009ba0b9243f4ace63533684cabe0dc05`            | Apache-2.0 `LICENSE`                                                      | Selected cloud and analytics guidance; Python, shell, and script paths excluded                                                                    |
| Cloudflare Skills — `third_party/agent-skills/cloudflare-skills/SOURCE.md`         | `cloudflare/skills@30553f89ae1ef1e3c2917cd09d72dac992bb4e9a`        | Apache-2.0 `LICENSE`                                                      | Selected Cloudflare/Wrangler/Agents SDK guidance and two command references; executables excluded                                                  |
| Sentry Agent Skills — `third_party/agent-skills/sentry-agent-skills/SOURCE.md`     | `getsentry/sentry-for-ai@3f7d285efc6f6ff5c5cfc5690857a9474c6642f8`  | MIT `LICENSE`                                                             | Selected framework SDK, AI-monitoring, and OTel guidance; session-replay reference excluded                                                        |
| wshobson Agents — `third_party/agent-skills/wshobson-agents/SOURCE.md`             | `wshobson/agents@c4b82b0ad771190355eb8e204b1329732a18449a`          | MIT `LICENSE`                                                             | Approved plugin skill subset only; marketplace agents, commands, and scripts excluded                                                              |

The generated `THIRD_PARTY_NOTICES.md` is the distribution-facing attribution surface. A provider
must appear in both that notice and the registry before its files may enter a package.

| Source class                                                 | License / terms                        | Included material                                       | Handling decision                                                                     |
| ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Fullstack Forge authored source, docs, schemas, and branding | Apache-2.0                             | Entire repository except noted external standards/links | Distributed under root `LICENSE` and `NOTICE`                                         |
| Agent Skills specification code                              | Apache-2.0                             | No code copied                                          | Concept only; linked and attributed                                                   |
| Agent Skills specification documentation                     | CC BY 4.0                              | No prose copied                                         | Facts summarized with attribution and source URL                                      |
| OWASP projects and cheat sheets                              | Project terms vary; public guidance    | No checklist/prose copied                               | Criteria summarized; primary URLs and versions recorded                               |
| NIST publications                                            | U.S. government works / site terms     | No text copied                                          | Control concepts referenced by publication identifier                                 |
| W3C WCAG/APG                                                 | W3C document license                   | No text copied                                          | Success-criterion names and primary links only                                        |
| IETF RFC 9110                                                | IETF Trust terms                       | No text copied                                          | Protocol semantics referenced by RFC number                                           |
| OpenAPI, OpenTelemetry, SLSA, PostgreSQL, Redis docs         | Respective project documentation terms | No text or code copied                                  | Versioned concepts and links only                                                     |
| UI UX Pro Max                                                | MIT                                    | No code, CSV data, prose, or assets copied              | Query results informed original design priorities; notice and exact revision recorded |
| Microsoft frontend design review                             | MIT                                    | No code, prose, templates, or assets copied             | Existing-system and review-structure concepts only                                    |
| AccessLint marketplace audit                                 | MIT stated by repository               | No code, prose, reports, or tool output copied          | Live-render and residual-manual-evidence concepts only                                |
| Expo skills                                                  | MIT                                    | No code, prose, or dependency choices copied            | Conditional platform/version routing concepts only                                    |
| shadcn/ui skill                                              | MIT                                    | No code, prose, registry data, or components copied     | Project-context and existing-primitive concepts only                                  |
| Vercel web interface guidelines                              | MIT                                    | No code or prose copied                                 | Review categories only; remote instruction fetching rejected                          |
| Addy Osmani Agent Skills                                     | MIT                                    | No code or prose copied                                 | Concept only                                                                          |
| Anthropic skills                                             | Per-skill; inspected Apache-2.0 sample | No code or prose copied                                 | Concept only; per-skill license caveat preserved                                      |
| OpenAI skills                                                | Per-skill; inspected Apache-2.0 sample | No code or prose copied                                 | Concept only; per-skill license caveat preserved                                      |
| Neon Postgres skills                                         | Apache-2.0                             | No code or prose copied                                 | Concept only                                                                          |
| Auth0 agent skills                                           | Apache-2.0                             | No code or prose copied                                 | Concept only                                                                          |
| Supabase agent skills                                        | MIT                                    | No code or prose copied                                 | Concept only                                                                          |
| Redis agent skills                                           | MIT                                    | No code or prose copied                                 | Concept only                                                                          |
| Vercel Labs Agent Skills                                     | No root license observed; sample MIT   | No code or prose copied                                 | Concepts only; absence of root grant prevented adaptation                             |
| Trail of Bits skills                                         | CC BY-SA 4.0                           | No protected prose/code copied                          | High-level taxonomy concepts only; no ShareAlike derivative included                  |
| Platform vendor documentation                                | Vendor site terms                      | No prose, screenshots, logos, or binaries copied        | Interoperability facts summarized with primary links                                  |

No dependency code is bundled into the CLI runtime. Development dependencies are installed from npm
and governed by their own licenses; `npm pack` includes compiled project output, not `node_modules`.
The package lock provides the exact development dependency graph for downstream license review.

## Historical text-overlap measurement (not current release evidence)

The following measurement is retained as historical research only. It is not evidence about the
current vendored provider set, and it must not be used as a release claim until rerun against the
current source corpus. On 2026-07-19 every then-authored Markdown file (`src/fullstack-forge/**`,
`docs/**`, `README.md` — 70 files, 61,341 words) was compared against the complete Markdown corpus
of eleven then-researched repositories at the exact commits recorded in `SOURCES.md`, read from
retained clone object stores.

Method: case-folded, punctuation-stripped, fenced-code-stripped word streams compared as 8-word
shingles (an 8-word verbatim run is well below the length of any original sentence, so this is a
deliberately sensitive threshold). Overlap is reported as shared shingles, and any match would be
extended greedily to report the longest verbatim shared run.

| Source                       | Markdown files | 8-gram shingles | Overlapping | Longest shared run |
| ---------------------------- | -------------: | --------------: | ----------: | -----------------: |
| trailofbits-skills           |            634 |         190,333 |           0 |                  0 |
| openai-skills                |            531 |         160,749 |           0 |                  0 |
| vercel-agent-skills          |            209 |          54,935 |           0 |                  0 |
| ui-ux-pro-max-skill          |            128 |          28,537 |           0 |                  0 |
| redis-agent-skills           |            118 |          28,919 |           0 |                  0 |
| addyosmani-agent-skills      |            112 |          64,420 |           0 |                  0 |
| anthropics-skills            |            109 |         113,146 |           0 |                  0 |
| auth0-agent-skills           |             60 |         111,493 |           0 |                  0 |
| supabase-agent-skills        |             46 |           8,020 |           0 |                  0 |
| neondatabase-postgres-skills |             14 |           4,014 |           0 |                  0 |
| agentskills-spec             |              6 |           1,650 |           0 |                  0 |
| **Total**                    |      **1,967** |     **766,216** |       **0** |              **0** |

Result: zero shared 8-word sequences across all 766,216 upstream shingles in that historical input.
It says nothing about the selected files now intentionally distributed under the current import
table. The separate registry, per-provider records, transforms, and notices are the authority for
those files.

This measurement also predates the 2026-07-26 frontend/UI/UX rewrite and the later upstream imports.
A fresh corpus comparison is required before making any new quantified overlap claim.
