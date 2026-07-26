# Research sources

Research performed 2026-07-18 and refreshed for the frontend/UI/UX system on 2026-07-26.
Repositories were cloned shallowly into an ignored temporary directory and inspected as untrusted
data; no scripts were executed and no source code or substantial prose was copied. Commit IDs make
the observations reproducible.

## Interoperability specifications and platform documentation

Vendor documentation is not version-addressable the way a Git commit is, so each row records its own
retrieval date. Re-verify a row before changing any generator or installer target that depends on
it.

| Source                              | URL                                                                              | Retrieved (UTC) | Use                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Agent Skills Specification          | <https://agentskills.io/specification>                                           | 2026-07-18      | Required `SKILL.md`, frontmatter, naming, description, progressive disclosure, and validation constraints                        |
| OpenAI Codex skills manual          | <https://learn.chatgpt.com/docs/build-skills.md>                                 | 2026-07-18      | Current `.agents/skills` repository path, discovery, explicit/implicit invocation, and optional `agents/openai.yaml`             |
| Claude Code slash commands / skills | <https://code.claude.com/docs/en/slash-commands>                                 | 2026-07-18      | `.claude/skills`, slash invocation, and legacy command distinction                                                               |
| Gemini CLI Agent Skills             | <https://geminicli.com/docs/cli/using-agent-skills/>                             | 2026-07-18      | Project `.gemini/skills` or `.agents/skills`; user `~/.gemini/skills` or `~/.agents/skills`                                      |
| Antigravity getting started         | <https://codelabs.developers.google.com/getting-started-google-antigravity>      | 2026-07-18      | Project `<project>/.agents/skills` and user `~/.gemini/config/skills` distinction                                                |
| Antigravity skill authoring         | <https://codelabs.developers.google.com/getting-started-with-antigravity-skills> | 2026-07-18      | Confirms installation-section paths; also records a later contradictory aside with older `.agent`/`antigravity-cli` names        |
| Cursor 2.4 skills changelog         | <https://cursor.com/changelog/2-4>                                               | 2026-07-18      | Agent Skills support in editor/CLI and slash invocation                                                                          |
| Cursor skills paths confirmation    | <https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167>       | 2026-07-18      | Product team confirmation that `.agents/skills` is supported; `.cursor/skills` is the product-specific path documented by Cursor |
| Windsurf / Devin Cascade skills     | <https://docs.devin.ai/desktop/cascade/skills>                                   | 2026-07-18      | `.windsurf/skills`, global Cascade path, `.agents/skills`, and `@skill-name` invocation                                          |
| GitHub Copilot Agent Skills         | <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>          | 2026-07-18      | `.github/skills`, compatible repository paths, personal paths, and selection behavior                                            |

Vendor documentation overrides older conventions found in reference repositories. In particular,
Fullstack Forge uses `.agents/skills` for current Codex repository installations rather than the
older `.codex/skills` convention. Antigravity and Gemini CLI are modeled as separate products:
Antigravity uses `<project>/.agents/skills` and `~/.gemini/config/skills`, while Gemini CLI accepts
the project and user aliases in the table. The Antigravity authoring codelab contains an internally
inconsistent later aside; the installer follows its explicit installation section and records the
ambiguity instead of treating Antigravity global scope as a generic-agent alias.

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

### Frontend, UI, and UX refresh (2026-07-26)

| Skill / source                   | Repository and inspected revision                                                                       | File or directory                                                           | License observed             | Concepts adapted                                                    | Reused wording or code                  | Attribution                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- | --------------------------------------- | -------------------------- |
| Anthropic frontend-design        | <https://github.com/anthropics/skills/tree/b29e7cf65e5cb78a5ac33d582270551bc74a14eb>                    | `skills/frontend-design/`                                                   | Apache-2.0                   | Product-grounded visual direction and rendered critique             | None                                    | Link and revision retained |
| Vercel React best practices      | <https://github.com/vercel-labs/agent-skills/tree/7c180d9044c9ae2b442b567aad4e42a28dd5ed62>             | `skills/react-best-practices/`                                              | MIT in skill metadata        | Impact-ranked waterfall, boundary, bundle, and rerender concepts    | None                                    | Link and revision retained |
| Vercel composition patterns      | same Vercel revision                                                                                    | `skills/composition-patterns/`                                              | MIT in skill metadata        | Explicit variants, composition, and state ownership                 | None                                    | Link and revision retained |
| Vercel React Native skills       | same Vercel revision                                                                                    | `skills/react-native-skills/`                                               | MIT in skill metadata        | Conditional mobile performance and platform guidance                | None                                    | Link and revision retained |
| Vercel web design router         | same Vercel revision                                                                                    | `skills/web-design-guidelines/`                                             | No standalone grant observed | Compact interface review surface; remote-main fetching was rejected | None                                    | Link and revision retained |
| Vercel web interface guidelines  | <https://github.com/vercel-labs/web-interface-guidelines/tree/4e799d45c17aec1498c269287a83b9dba22b966b> | `command.md`                                                                | MIT                          | Broad actionable interface review categories                        | None                                    | Link and revision retained |
| Microsoft frontend design review | <https://github.com/microsoft/skills/tree/4f1db7ec55caf11e3b143c91220bd79a632bc55b>                     | `skills/frontend-design-review/`                                            | MIT                          | Existing-system inspection and structured review                    | None                                    | Link and revision retained |
| UI UX Pro Max                    | <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/1307d97a72e6c1cda572cb65471ae5ce82995218> | `skills/ui-ux-pro-max/`                                                     | MIT                          | Domain taxonomy and progressive detail routing                      | None; no data files or generated system | Link and revision retained |
| AccessLint audit                 | <https://github.com/accesslint/claude-marketplace/tree/ceb3fa80fc8be8d8959f5b3eb812ac8cc33a5a59>        | `skills/audit/`                                                             | MIT stated by repository     | Live-DOM evidence, cause deduplication, residual manual gaps        | None                                    | Link and revision retained |
| Expo skills                      | <https://github.com/expo/skills/tree/09eb052410e7f609624cb161ea4cd9576c69cd5d>                          | `skills/expo-ui/`, `expo-native-ui/`, `expo-router/`, `expo-data-fetching/` | MIT                          | Version/platform detection and focused native references            | None                                    | Link and revision retained |
| shadcn skill                     | <https://github.com/shadcn-ui/ui/tree/7774cd7dcee1e98d0815aa6e829f33a7fc952fdf>                         | `skills/shadcn/`                                                            | MIT                          | Project-context inspection, primitive reuse, source ownership       | None                                    | Link and revision retained |

All repositories were inspected at the exact revisions above without running their scripts. The
Vercel web-design router’s unpinned network fetch was explicitly not adopted. The refresh informed
the original architecture documented in `research/FRONTEND_UI_UX_SYSTEM.md`; it contributed no
third-party prose, code, datasets, templates, or assets.

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
