# Research sources

Research performed 2026-07-18. Repositories were cloned shallowly into an ignored temporary
directory and inspected as untrusted data; no scripts were executed and no source code or
substantial prose was copied. Commit IDs make the observations reproducible.

## Interoperability specifications and platform documentation

| Source                              | URL                                                                                                 | Use                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Agent Skills Specification          | <https://agentskills.io/specification>                                                              | Required `SKILL.md`, frontmatter, naming, description, progressive disclosure, and validation constraints                        |
| OpenAI Codex skills manual          | <https://learn.chatgpt.com/docs/build-skills.md>                                                    | Current `.agents/skills` repository path, discovery, explicit/implicit invocation, and optional `agents/openai.yaml`             |
| Claude Code slash commands / skills | <https://code.claude.com/docs/en/slash-commands>                                                    | `.claude/skills`, slash invocation, and legacy command distinction                                                               |
| Gemini CLI skills tutorial          | <https://geminicli.com/docs/cli/tutorials/skills-getting-started/>                                  | `.gemini/skills`, `.agents/skills` alias, activation and reload behavior                                                         |
| Antigravity CLI skills codelab      | <https://codelabs.developers.google.com/antigravity/how-to-create-agent-skills-for-antigravity-cli> | Current `.agents/skills` CLI convention                                                                                          |
| Cursor 2.4 skills changelog         | <https://cursor.com/changelog/2-4>                                                                  | Agent Skills support in editor/CLI and slash invocation                                                                          |
| Cursor skills paths confirmation    | <https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167>                          | Product team confirmation that `.agents/skills` is supported; `.cursor/skills` is the product-specific path documented by Cursor |
| Windsurf / Devin Cascade skills     | <https://docs.devin.ai/desktop/cascade/skills>                                                      | `.windsurf/skills`, global Cascade path, `.agents/skills`, and `@skill-name` invocation                                          |
| GitHub Copilot Agent Skills         | <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>                             | `.github/skills`, compatible repository paths, personal paths, and selection behavior                                            |

Vendor documentation overrides older conventions found in reference repositories. In particular,
Fullstack Forge uses `.agents/skills` for current Codex repository installations rather than the
older `.codex/skills` convention.

## Engineering standards and primary guidance

| Area                       | Source                                                    | URL                                                                                                      |
| -------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Application security       | OWASP ASVS 5.0.0                                          | <https://owasp.org/www-project-application-security-verification-standard/>                              |
| API security               | OWASP API Security Top 10 2023                            | <https://owasp.org/API-Security/editions/2023/en/0x04-release-notes/>                                    |
| Uploads                    | OWASP File Upload Cheat Sheet                             | <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>                            |
| Authentication             | OWASP Authentication Cheat Sheet                          | <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>                         |
| Authorization              | OWASP Authorization Cheat Sheet                           | <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>                          |
| Injection                  | OWASP Injection Prevention Cheat Sheet                    | <https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html>                   |
| XSS                        | OWASP Cross Site Scripting Prevention Cheat Sheet         | <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>        |
| CSRF                       | OWASP CSRF Prevention Cheat Sheet                         | <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>  |
| SSRF                       | OWASP SSRF Prevention Cheat Sheet                         | <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html> |
| Browser headers            | OWASP HTTP Headers Cheat Sheet                            | <https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html>                           |
| Logging                    | OWASP Logging Cheat Sheet                                 | <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>                                |
| Secrets                    | OWASP Secrets Management Cheat Sheet                      | <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>                     |
| Threat modeling            | OWASP Threat Modeling Cheat Sheet                         | <https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html>                        |
| Multi-tenancy              | OWASP Multi Tenant Security Cheat Sheet                   | <https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html>                  |
| Payments                   | OWASP Third Party Payment Gateway Integration Cheat Sheet | <https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Payment_Gateway_Integration.html>            |
| AI prompt injection        | OWASP LLM Prompt Injection Prevention Cheat Sheet         | <https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html>        |
| AI agents                  | OWASP AI Agent Security Cheat Sheet                       | <https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html>                      |
| Secure development         | NIST SSDF SP 800-218 v1.1                                 | <https://csrc.nist.gov/pubs/sp/800/218/final>                                                            |
| Privacy                    | NIST Privacy Framework                                    | <https://www.nist.gov/privacy-framework>                                                                 |
| Accessibility              | WCAG 2.2 Recommendation                                   | <https://www.w3.org/TR/WCAG22/>                                                                          |
| Accessible widgets         | WAI-ARIA Authoring Practices Guide                        | <https://www.w3.org/WAI/ARIA/apg/>                                                                       |
| API contracts              | OpenAPI Specification 3.2.0                               | <https://spec.openapis.org/oas/v3.2.0.html>                                                              |
| HTTP semantics             | RFC 9110                                                  | <https://www.rfc-editor.org/rfc/rfc9110.html>                                                            |
| Database indexes           | PostgreSQL 18 documentation                               | <https://www.postgresql.org/docs/current/indexes.html>                                                   |
| Query plans                | PostgreSQL 18 index/EXPLAIN guidance                      | <https://www.postgresql.org/docs/18/indexes-examine.html>                                                |
| Cache eviction             | Redis current eviction reference                          | <https://redis.io/docs/latest/develop/reference/eviction/>                                               |
| Telemetry                  | OpenTelemetry Specification 1.59.0                        | <https://opentelemetry.io/docs/specs/otel/>                                                              |
| Supply chain               | SLSA Specification 1.2                                    | <https://slsa.dev/spec/v1.2/>                                                                            |
| Web performance            | Google Core Web Vitals guidance                           | <https://developers.google.com/search/docs/appearance/core-web-vitals>                                   |
| Web performance thresholds | web.dev threshold methodology                             | <https://web.dev/articles/defining-core-web-vitals-thresholds>                                           |

Standards are used as criteria and vocabulary, not copied checklists or claims of certification.
Time-sensitive facts must be re-verified when a future release changes guidance.

## Open-source conceptual references

| Repository                                                | Inspected commit                           | Observed license                                        | Concepts studied                                                                             |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill> | `f8ac5e1266dba8354ea96e19994d9f4345e7ec31` | MIT                                                     | Data-backed UI/UX topic organization, platform template registry, responsive/a11y priorities |
| <https://github.com/addyosmani/agent-skills>              | `06300e258ef62cdbfbc9b1615ac5b4f58bee05ac` | MIT                                                     | Progressive skill disclosure and focused specialist scopes                                   |
| <https://github.com/anthropics/skills>                    | `fa0fa64bdc967915dc8399e803be67759e1e62b8` | Per skill; inspected sample Apache-2.0                  | Skill directory structure and self-contained procedures                                      |
| <https://github.com/vercel-labs/agent-skills>             | `f8a72b9603728bb92a217a879b7e62e43ad76c81` | No root license observed; inspected sample declares MIT | Framework-specific skill boundaries; concepts only                                           |
| <https://github.com/neondatabase/postgres-skills>         | `0d9a967085c3bc137ab39ff9e3191c2eb3129d8c` | Apache-2.0                                              | Database-focused skill decomposition                                                         |
| <https://github.com/supabase/agent-skills>                | `1ad9aaeb49caafd9e95c0a91116f71890eebbc53` | MIT                                                     | Platform-aware database and service guidance                                                 |
| <https://github.com/redis/agent-skills>                   | `23e10ae0295d7669f1e0edcc749812fb9e7aaf85` | MIT                                                     | Cache-specific skill coverage                                                                |
| <https://github.com/auth0/agent-skills>                   | `0d426960256fe7e54e05495fab64208e1924f23b` | Apache-2.0                                              | Authentication skill scope and agent packaging                                               |
| <https://github.com/trailofbits/skills>                   | `cfe5d7b1619e47fb5b38b7e2561dad7e5f1e89af` | CC BY-SA 4.0                                            | Security skill taxonomy; concepts only, no adaptation of protected text                      |
| <https://github.com/openai/skills>                        | `49f948faa9258a0c61caceaf225e179651397431` | Per skill; inspected sample Apache-2.0                  | Resource routing, concise master skills, validation discipline                               |
| <https://github.com/agentskills/agentskills>              | `38a2ff82958afee88dadf4831509e6f7e9d8ef4e` | Apache-2.0 code; CC BY 4.0 docs                         | Open Agent Skills format and validator expectations                                          |

## Design research

The locally installed UI/UX Pro Max skill was queried for a professional developer
audit/documentation tool. It recommended a minimal Swiss-style system, high contrast, neutral slate
with a blue action accent, JetBrains Mono plus IBM Plex Sans, strong hierarchy, visible focus,
responsive behavior, and reduced motion. Fullstack Forge applies the conceptual priorities, but uses
original assets and no copied code, data file, prose, or font binary.
