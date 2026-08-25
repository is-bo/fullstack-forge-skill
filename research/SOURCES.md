# Research sources

Research performed 2026-08-10 (ecosystem and harness refresh; prior frontend/UI/UX refresh on
2026-07-26). Repositories were cloned shallowly into an ignored temporary directory and inspected as
untrusted data; no scripts were executed. Conceptual observations were independently authored. The
separate pinned imports listed below are the reviewed exception: only their explicit allowlisted
files are copied, and each import has a checksum, license record, and attribution notice. Commit IDs
make both kinds of observations reproducible.

## Interoperability specifications and platform documentation

Vendor documentation is not version-addressable the way a Git commit is, so each row records its own
retrieval date. Re-verify a row before changing any generator or installer target that depends on
it.

| Source                          | URL                                                                              | Retrieved (UTC) | Use                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Agent Skills Specification      | <https://agentskills.io/specification>                                           | 2026-08-10      | Required `SKILL.md`, frontmatter, naming, description, progressive disclosure, and validation constraints                 |
| OpenAI Codex skills manual      | <https://learn.chatgpt.com/docs/build-skills>                                    | 2026-08-10      | Current `.agents/skills` discovery, explicit/implicit invocation, `agents/openai.yaml`, and user/admin skill scopes       |
| OpenAI Codex plugin packaging   | <https://developers.openai.com/plugins/build/plugins>                            | 2026-08-10      | `.codex-plugin/plugin.json`, plugin `skills/` contract, npm marketplace sources, and package publication boundaries       |
| OpenAI Codex npm marketplace    | <https://github.com/openai/codex/pull/29375>                                     | 2026-08-10      | Merged support for `{source: "npm", package, version}` marketplace entries and hardened npm materialization               |
| Claude Code skills              | <https://code.claude.com/docs/en/skills>                                         | 2026-08-10      | `.claude/skills`, user/project scopes, invocation control, and dynamic context extensions                                 |
| Gemini CLI Agent Skills         | <https://geminicli.com/docs/cli/creating-skills/>                                | 2026-08-10      | Project `.gemini/skills` and `.agents/skills` alias, user scope, extensions, and `/skills` selection                      |
| Antigravity getting started     | <https://codelabs.developers.google.com/getting-started-google-antigravity>      | 2026-07-18      | Project `<project>/.agents/skills` and user `~/.gemini/config/skills` distinction                                         |
| Antigravity skill authoring     | <https://codelabs.developers.google.com/getting-started-with-antigravity-skills> | 2026-07-18      | Confirms installation-section paths; also records a later contradictory aside with older `.agent`/`antigravity-cli` names |
| Cursor Agent Skills             | <https://cursor.com/docs/skills>                                                 | 2026-08-10      | `.cursor/skills`, compatible `.agents`/`.claude`/`.codex` paths, nested discovery, and slash invocation                   |
| Cursor 2.4 skills changelog     | <https://cursor.com/changelog/2-4>                                               | 2026-07-18      | Agent Skills support in editor/CLI; retained as historical release evidence                                               |
| Windsurf / Devin Cascade skills | <https://docs.windsurf.com/windsurf/cascade/skills>                              | 2026-08-10      | `.windsurf/skills`, global Cascade path, `.agents` aliases, and `@skill-name`; URL currently redirects to Devin docs      |
| GitHub Copilot Agent Skills     | <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>          | 2026-08-10      | `.github/skills`, `.claude/skills`, `.agents/skills`, user scopes, and selection behavior                                 |
| GitHub / VS Code Agent Skills   | <https://code.visualstudio.com/docs/agent-customization/agent-skills>            | 2026-08-10      | VS Code/Copilot discovery precedence and supported project/user skill roots                                               |
| OpenCode skills                 | <https://opencode.ai/docs/skills>                                                | 2026-08-10      | Native `.opencode/skills` plus compatible `.claude/skills` and `.agents/skills`; permission rules and `skill` tool        |
| Cline skills (experimental)     | <https://docs.cline.bot/customization/skills>                                    | 2026-08-10      | Experimental `.cline/skills`, `.clinerules/skills`, and `.claude/skills`; no official `.agents` alias observed            |
| Roo Code skills                 | <https://docs.roocode.com/features/skills>                                       | 2026-08-10      | `.roo/skills` and compatible `.agents/skills`; mode-specific roots and file watching                                      |

Vendor documentation overrides older conventions found in reference repositories. In particular,
Fullstack Forge uses `.agents/skills` for current Codex repository installations rather than the
older `.codex/skills` convention. Antigravity and Gemini CLI are modeled as separate products:
Antigravity uses `<project>/.agents/skills` and `~/.gemini/config/skills`, while Gemini CLI accepts
the project and user aliases in the table. The Antigravity authoring codelab contains an internally
inconsistent later aside; the installer follows its explicit installation section and records the
ambiguity instead of treating Antigravity global scope as a generic-agent alias.

OpenCode and Roo Code are recorded as generic `.agents/skills` compatibility only; Forge does not
generate `.opencode/` or `.roo/` roots. Cline is a best-effort `.claude/skills` path while its
Skills feature is experimental, and the official Cline documentation does not establish an `.agents`
alias. These are documentation decisions, not claims that a live host UI accepted a command.

## Current pinned vendored imports (candidate v0.3)

The following table closes the boundary between ecosystem research and shipped material. It is an
index only; `config/upstream-providers.json` is the machine-readable allowlist and each linked
`SOURCE.md` records the selected paths, exclusions, checksum, instruction review, and attribution.

| Provider                 | Repository and pinned commit                                        | License evidence                                                | Import record                                              |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| Impeccable               | `pbakaus/impeccable@fc2e694afca1ac0cc384b4fe56bab3335fea7912`       | Apache-2.0 `LICENSE`                                            | `third_party/agent-skills/impeccable/SOURCE.md`            |
| Addy Osmani Agent Skills | `addyosmani/agent-skills@ff2df4c07e7836a092ed28e1e9b42f4d6009280c`  | MIT `LICENSE`                                                   | `third_party/agent-skills/addy-agent-skills/SOURCE.md`     |
| Vercel Agent Skills      | `vercel-labs/agent-skills@7c180d9044c9ae2b442b567aad4e42a28dd5ed62` | README `#license` plus selected skill metadata; no root license | `third_party/agent-skills/vercel-agent-skills/SOURCE.md`   |
| Supabase Agent Skills    | `supabase/agent-skills@1ad9aaeb49caafd9e95c0a91116f71890eebbc53`    | MIT `LICENSE`                                                   | `third_party/agent-skills/supabase-agent-skills/SOURCE.md` |
| Google Skills            | `google/skills@d1c9be2009ba0b9243f4ace63533684cabe0dc05`            | Apache-2.0 `LICENSE`                                            | `third_party/agent-skills/google-skills/SOURCE.md`         |
| Cloudflare Skills        | `cloudflare/skills@30553f89ae1ef1e3c2917cd09d72dac992bb4e9a`        | Apache-2.0 `LICENSE`                                            | `third_party/agent-skills/cloudflare-skills/SOURCE.md`     |
| Sentry Agent Skills      | `getsentry/sentry-for-ai@3f7d285efc6f6ff5c5cfc5690857a9474c6642f8`  | MIT `LICENSE`                                                   | `third_party/agent-skills/sentry-agent-skills/SOURCE.md`   |
| wshobson Agents          | `wshobson/agents@c4b82b0ad771190355eb8e204b1329732a18449a`          | MIT `LICENSE`                                                   | `third_party/agent-skills/wshobson-agents/SOURCE.md`       |

Only these eight providers are currently vendored. All other rows in the ecosystem and conceptual
reference sections are research links or historical comparisons, not package inputs.

### Current harness compatibility matrix (snapshot 2026-08-10)

The class column describes the repository integration decision, not vendor product quality: Class A
is a first-class generated target with an official project convention; Class B is an officially
documented generic-path compatibility decision; Class C is experimental or otherwise not verified
enough to generate a new root.

| Harness        | Official convention observed                                                         | Forge decision                                                                                        | Class | Gap / uncertainty                                                                            |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| OpenAI Codex   | Project `.agents/skills`; plugins require `skills/` plus `.codex-plugin/plugin.json` | Generate `.agents/skills` for projects and thin package `skills/` adapters for the first-class plugin | A     | npm publication and live plugin activation remain release checks, not repository-only proof. |
| Claude Code    | Project `.claude/skills` and user skill scopes                                       | Keep `.claude/skills` generated target                                                                | A     | Live Claude UI invocation is not exercised by CI.                                            |
| GitHub Copilot | Repository `.github/skills` and compatible Agent Skills paths                        | Keep `.github/skills` generated target                                                                | A     | VS Code/Copilot precedence can change; recheck first-party docs on upgrades.                 |
| Cursor         | `.cursor/skills`, with `.agents`/`.claude` compatibility                             | Keep `.cursor/skills` generated target                                                                | A     | Product-specific slash UI is not a stable executable contract.                               |
| Gemini CLI     | `.gemini/skills` and `.agents/skills` project aliases                                | Keep `.gemini/skills`; retain generic fallback                                                        | A     | Antigravity global path remains a separately documented ambiguity.                           |
| Windsurf       | `.windsurf/skills`, `.agents` aliases, and `@skill-name`                             | Keep `.windsurf/skills` generated target                                                              | A     | The Windsurf URL currently redirects to Devin/Cascade documentation.                         |
| OpenCode       | Native `.opencode/skills` plus compatible `.claude/skills` and `.agents/skills`      | Use generic `.agents/skills`; do not invent an `.opencode` installer root                             | B     | Native root and precedence are not needed for the current generic package.                   |
| Roo Code       | Native `.roo/skills` plus compatible `.agents/skills`                                | Use generic `.agents/skills`; do not invent a `.roo` installer root                                   | B     | Mode-specific roots and precedence are not needed for the current generic package.           |
| Cline          | Experimental `.cline/skills`, `.clinerules/skills`, and `.claude/skills`             | Best-effort `.claude/skills`; no `.cline` target                                                      | C     | Experimental behavior and no official `.agents` alias make live support `NOT_VERIFIED`.      |

Highest-priority follow-up is to publish and clean-room install the pinned npm package, then run the
supplied Codex plugin validator against the generated `skills/` adapters. The next gaps are live
host UI tests (all currently `NOT_VERIFIED`), a future decision on native Roo/OpenCode roots if
their generic aliases regress, and file-level license review before importing any Class B/C
ecosystem source.

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

## Reviewed ecosystem opportunities (snapshot 2026-08-10)

Class A means an active, clearly licensed source that is legally suitable for selective vendoring
after pinning and attribution. Class B means useful but overlapping, vendor-specific, experimental,
or otherwise requiring a narrower integration. Class C means no clear reuse grant, copyleft or mixed
licensing concerns, or insufficient maintenance evidence; keep it as a link or concept reference.
Stars are GitHub API or page snapshots, not quality or security evidence.

| Class | Source (stars on 2026-08-10)                                                            | License evidence                                      | Decision for Fullstack Forge                                                                                                            | Uncertainty / follow-up                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | [Impeccable](https://github.com/pbakaus/impeccable) (57,054)                            | Apache-2.0                                            | Keep the pinned, attributed UI/UX concepts already used by Forge.                                                                       | Recheck upstream commit and attribution at every update.                                                                                                                   |
| A     | [Addy Osmani Agent Skills](https://github.com/addyosmani/agent-skills) (84,694)         | MIT                                                   | Keep selective lifecycle, testing, debugging, performance, and delivery guidance; pin revisions.                                        | Large, fast-moving repo; avoid unreviewed bulk imports.                                                                                                                    |
| A     | [Superpowers](https://github.com/obra/superpowers) (269,648)                            | MIT                                                   | Offer as an optional workflow comparison; do not vendor its overlapping orchestration wholesale.                                        | Strong overlap with Forge workflow and high change velocity.                                                                                                               |
| A     | [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (114,957)      | MIT                                                   | Keep as a concept-only comparator where Forge already has UI/UX coverage.                                                               | Large taxonomy may conflict with Forge routing; review generated/data assets.                                                                                              |
| B     | [Taste (Leonxlnx)](https://github.com/Leonxlnx/taste-skill) (~74,600)                   | MIT                                                   | Keep as an explicit, user-managed advisory comparator only; do not vendor or auto-compose it.                                           | V2 is an 87,253-byte experimental monolith with no tags, releases, CI, or eval harness; it substantially overlaps and sometimes conflicts with pinned Impeccable guidance. |
| B     | [Everything Claude Code / ECC](https://github.com/affaan-m/ECC) (238,911)               | MIT                                                   | Audit selectively for specialist gaps; do not bulk-copy hooks, agents, or memory systems.                                               | Broad surface and one primary maintainer increase collision and supply-chain risk.                                                                                         |
| B     | [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills) (~29,900)            | README says MIT; root grant absent at pinned revision | Selectively vendor only the reviewed paths recorded in the pinned-import table; require manual license-evidence review on every update. | “MIT” is corroborated by the selected skill metadata, but it is not a substitute for a root license; excluded deployment/writing/tooling paths remain out of scope.        |
| C     | [Anthropic Skills](https://github.com/anthropics/skills) (~167,200)                     | Mixed/per-skill; some source-available docs           | Use architecture ideas and per-skill links; no bulk vendoring.                                                                          | License differs by skill; inspect each file before reuse.                                                                                                                  |
| C     | [Trail of Bits Skills](https://github.com/trailofbits/skills) (~6,500)                  | CC BY-SA 4.0                                          | Keep as a security taxonomy/link; do not import into Apache-2.0 runtime assets.                                                         | Share-alike obligations and file-level provenance need legal review.                                                                                                       |
| C     | [Taste (senlindesign)](https://github.com/senlindesign/taste-skill) (stars unavailable) | No license observed                                   | Link only; no code, prose, or assets may be copied.                                                                                     | Public repository status and license remain unverified.                                                                                                                    |

The counts above were captured from GitHub metadata on the snapshot date and can drift daily. A
missing or ambiguous license is treated as no permission to redistribute; attribution does not cure
that gap. Forge's canonical imports remain governed by
`.fullstack-forge/manifests/upstream-registry.json` and `THIRD_PARTY_NOTICES.md`, not by star
counts.

Taste received a preservation review because of its adoption signal. The reviewed v2 head was
`e988add20dab0fa97d7a76781c48961c8184288e` and its `SKILL.md` SHA-256 was
`aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`. Its distinctive anti-pattern
catalogue can be useful as an isolated, read-only comparison for an explicitly requested marketing
surface, but its roughly 22,000-token context cost, opinionated framework and motion rules,
executable/network suggestions, and overlap with Impeccable make default inclusion a net loss.
Impeccable remains the authoritative progressive UI/UX source; accessibility, repository evidence,
and Forge verification retain precedence. Any optional Taste use must pin and verify the immutable
file, preserve its MIT notice, prohibit implicit activation and mutation authority, and avoid
copying its scripts or repository-wide instructions.

## Open-source conceptual references (historical research; not additional package inputs)

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
Vercel web-design router’s unpinned network fetch was explicitly not adopted. This section records
the conceptual research that informed the original architecture documented in
`research/FRONTEND_UI_UX_SYSTEM.md`; it is not an additional source of package files. Current
vendoring is limited to the pinned-import table above.

The compact repository table below is an older conceptual-research baseline retained for historical
traceability; its revisions do not override the current pinned-import table.

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
