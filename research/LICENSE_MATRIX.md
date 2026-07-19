# License matrix

This matrix records what was used and why the repository's Apache-2.0 distribution remains clean.
“Concept only” means ideas and interoperability facts were learned, while implementation and prose
were independently authored.

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

## Measured text-overlap verification

The "no copied prose" claim above is measured, not merely asserted. On 2026-07-19 every authored
Markdown file (`src/fullstack-forge/**`, `docs/**`, `README.md` — 70 files, 61,341 words) was
compared against the complete Markdown corpus of all eleven researched repositories at the exact
commits recorded in `SOURCES.md`, read from the retained clone object stores.

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

Result: zero shared 8-word sequences across all 766,216 upstream shingles. No sentence, checklist
line, or paragraph in the distribution is shared with any researched repository. This is
particularly load-bearing for Trail of Bits (CC BY-SA 4.0), where any adapted prose would impose
share-alike terms incompatible with the Apache-2.0 core, and for UI UX Pro Max (MIT), whose data
files and prose are likewise absent.

Re-run this comparison whenever module prose is substantially rewritten or a new upstream source is
studied.
