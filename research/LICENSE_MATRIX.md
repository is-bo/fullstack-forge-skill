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
