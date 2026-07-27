# Third-party notices

Fullstack Forge is original implementation work licensed under Apache-2.0. It **vendors** selected
open-source Agent Skills content from the projects listed below, and it **references** further
public standards and documentation for concepts only.

Every vendored import is pinned to an immutable commit, restricted to an explicit path allowlist,
checksummed, and reviewed. Nothing is fetched at runtime and nothing updates automatically. Run
`npm run upstream:status` to inspect exactly what is installed.

The upstream maintainers do not endorse Fullstack Forge, and this project is not affiliated with
them. Upstream copyright notices and licence terms are preserved verbatim in
`third_party/agent-skills/<provider>/` and are installed alongside the content they cover as
`UPSTREAM-LICENSE`, `UPSTREAM-NOTICE`, and `UPSTREAM-SOURCE.md`.

## Vendored sources

### Impeccable

- Source: https://github.com/pbakaus/impeccable
- Licence: **Apache-2.0** (read from `LICENSE`)
- Copyright: Copyright the Impeccable authors
- Imported release: `skill-v4.0.2`
- Imported commit: `fc2e694afca1ac0cc384b4fe56bab3335fea7912`
- Files vendored: 56
- Content checksum: `9ac0804b64121bcdd9c1c14811d7232c57fb3272f07162732d0f07ed8ddd15c9`
- Update policy: reviewed-only

Selected paths:

- `.claude/skills/impeccable/SKILL.md`
- `.claude/skills/impeccable/reference/`
- `.claude/skills/impeccable/scripts/command-metadata.json`
- `.claude/skills/impeccable/scripts/detector/`
- `.claude/skills/impeccable/scripts/lib/impeccable-config.mjs`
- `LICENSE`
- `NOTICE.md`

Excluded paths:

- `.claude/skills/impeccable/scripts/detector/browser/`
- `.claude/skills/impeccable/scripts/detector/detect-antipatterns-browser.js`
- `.claude/skills/impeccable/scripts/detector/detect-antipatterns.mjs`

Declared runtime executables: 18. These run only through Forge's detector adapter, against local files, and never because a module was loaded.

Import notes: The detector import closure is vendored whole so the module graph resolves offline; the 350 KiB pre-bundled browser detector and the browser-injection payload are excluded because Forge only ever runs the detector against local files. `forge ui live` ships guidance only: the interactive live server, hook system, and screenshot runtime are deliberately not imported.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### Addy Osmani Agent Skills

- Source: https://github.com/addyosmani/agent-skills
- Licence: **MIT** (read from `LICENSE`)
- Copyright: Copyright (c) Addy Osmani
- Imported release: `0.6.5`
- Imported commit: `ff2df4c07e7836a092ed28e1e9b42f4d6009280c`
- Files vendored: 32
- Content checksum: `eec969dc7508586a185eb38742379c480b50b8c86a94e177b7f292086b3352c3`
- Update policy: reviewed-only

Selected paths:

- `LICENSE`
- `references/accessibility-checklist.md`
- `references/definition-of-done.md`
- `references/observability-checklist.md`
- `references/performance-checklist.md`
- `references/security-checklist.md`
- `references/testing-patterns.md`
- `skills/api-and-interface-design/`
- `skills/browser-testing-with-devtools/`
- `skills/ci-cd-and-automation/`
- `skills/code-review-and-quality/`
- `skills/code-simplification/`
- `skills/debugging-and-error-recovery/`
- `skills/deprecation-and-migration/`
- `skills/documentation-and-adrs/`
- `skills/doubt-driven-development/`
- `skills/frontend-ui-engineering/`
- `skills/git-workflow-and-versioning/`
- `skills/idea-refine/`
- `skills/incremental-implementation/`
- `skills/interview-me/`
- `skills/observability-and-instrumentation/`
- `skills/performance-optimization/`
- `skills/planning-and-task-breakdown/`
- `skills/security-and-hardening/`
- `skills/shipping-and-launch/`
- `skills/source-driven-development/`
- `skills/spec-driven-development/`
- `skills/test-driven-development/`

Excluded paths:

- `**/scripts/`

Import notes: `using-agent-skills`, the global routing and bootstrap instructions, the slash commands, the personas, and the session hooks are deliberately excluded: Forge owns routing and orchestration.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### Vercel Agent Skills

- Source: https://github.com/vercel-labs/agent-skills
- Licence: **MIT** (read from `README.md#license`)
- Copyright: Copyright (c) Vercel, Inc.
- Imported release: _no stable release at import time; the reviewed default-branch head is pinned_
- Imported commit: `7c180d9044c9ae2b442b567aad4e42a28dd5ed62`
- Files vendored: 194
- Content checksum: `3c3b2a3fbfb3510e2d64a7e412c6b94421b3193a8ebae6e882f17a6fd82764c6`
- Update policy: reviewed-only

Selected paths:

- `README.md`
- `skills/react-best-practices/`
- `skills/react-native-skills/`
- `skills/react-view-transitions/`
- `skills/vercel-optimize/`
- `skills/web-design-guidelines/`

Excluded paths:

- `**/lib/`
- `**/scripts/`
- `**/tests/`

Import notes: The repository has no LICENSE file at the pinned commit; MIT is declared in README.md and in each selected SKILL.md frontmatter (`license: MIT`). Both are recorded verbatim in SOURCE.md as the licence evidence. `writing-guidelines`, `deploy-to-vercel`, and `vercel-cli-with-tokens` are excluded: Forge does not adopt a house writing style and does not import autonomous deployment.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### Supabase Agent Skills

- Source: https://github.com/supabase/agent-skills
- Licence: **MIT** (read from `LICENSE`)
- Copyright: Copyright (c) Supabase, Inc.
- Imported release: `v0.1.6`
- Imported commit: `1ad9aaeb49caafd9e95c0a91116f71890eebbc53`
- Files vendored: 41
- Content checksum: `9f0d34ce17b71a69237735448a0f333501d28480a3685c4b7ef92ae362633571`
- Update policy: reviewed-only

Selected paths:

- `LICENSE`
- `skills/supabase-postgres-best-practices/`
- `skills/supabase/`

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### Google Skills

- Source: https://github.com/google/skills
- Licence: **Apache-2.0** (read from `LICENSE`)
- Copyright: Copyright Google LLC
- Imported release: _no stable release at import time; the reviewed default-branch head is pinned_
- Imported commit: `d1c9be2009ba0b9243f4ace63533684cabe0dc05`
- Files vendored: 104
- Content checksum: `38636729b3ae06c5db6dced55a3a9c85f3aa75b006986a09220681c9c86d490a`
- Update policy: reviewed-only

Selected paths:

- `LICENSE`
- `skills/analytics/google-analytics-admin-api-basics/`
- `skills/analytics/google-analytics-data-api-basics/`
- `skills/cloud/agent-platform-deploy/`
- `skills/cloud/agent-platform-eval-flywheel/`
- `skills/cloud/agent-platform-inference/`
- `skills/cloud/cloud-run-basics/`
- `skills/cloud/cloud-sql-basics/`
- `skills/cloud/firebase-basics/`
- `skills/cloud/gemini-agents-api/`
- `skills/cloud/gemini-api/`
- `skills/cloud/gke-multitenancy/`
- `skills/cloud/gke-observability/`
- `skills/cloud/gke-platform-security/`
- `skills/cloud/gke-productionize/`
- `skills/cloud/gke-reliability/`
- `skills/cloud/gke-storage/`
- `skills/cloud/gke-workload-scaling/`
- `skills/cloud/gke-workload-security/`
- `skills/cloud/google-cloud-networking-observability/`
- `skills/cloud/google-cloud-solution-architecture/`
- `skills/cloud/google-cloud-storage-basics/`
- `skills/cloud/google-cloud-waf-cost-optimization/`
- `skills/cloud/google-cloud-waf-operational-excellence/`
- `skills/cloud/google-cloud-waf-performance-optimization/`
- `skills/cloud/google-cloud-waf-reliability/`
- `skills/cloud/google-cloud-waf-security/`

Excluded paths:

- `**/*.py`
- `**/*.sh`
- `**/scripts/`

Import notes: The five Well-Architected pillars are published as `google-cloud-waf-*`; the sustainability pillar is not requested. Provider scripts (`*.py`, `*.sh`) are not imported: no Google executable may run because a Forge module loaded.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### Cloudflare Skills

- Source: https://github.com/cloudflare/skills
- Licence: **Apache-2.0** (read from `LICENSE`)
- Copyright: Copyright Cloudflare, Inc.
- Imported release: _no stable release at import time; the reviewed default-branch head is pinned_
- Imported commit: `30553f89ae1ef1e3c2917cd09d72dac992bb4e9a`
- Files vendored: 352
- Content checksum: `f14e1e97699868ab89bc95f77c34f307fdb8a6e4d7b7a4d16007f7430b1aca38`
- Update policy: reviewed-only

Selected paths:

- `LICENSE`
- `commands/build-agent.md`
- `commands/build-mcp.md`
- `skills/agents-sdk/`
- `skills/cloudflare/`
- `skills/durable-objects/`
- `skills/sandbox-sdk/`
- `skills/web-perf/`
- `skills/wrangler/`

Import notes: `building-mcp-server-on-cloudflare` and `building-ai-agent-on-cloudflare` are published as the command files `commands/build-mcp.md` and `commands/build-agent.md`, not as skills; they are imported as references, never as user-facing Forge commands.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### Sentry Agent Skills

- Source: https://github.com/getsentry/sentry-agent-skills
- Licence: **Apache-2.0** (read from `README.md#license`)
- Copyright: Copyright Functional Software, Inc. dba Sentry
- Imported release: _no stable release at import time; the reviewed default-branch head is pinned_
- Imported commit: `9f54eb021916a7cff2c04a9f4e4c1f9439f3202c`
- Files vendored: 61
- Content checksum: `18067aa3313135f9a31506ca55a185f53f703d23df7a1722241febf17fe47a26`
- Update policy: reviewed-only

Selected paths:

- `README.md`
- `skills/sentry-dotnet-sdk/`
- `skills/sentry-fix-issues/`
- `skills/sentry-go-sdk/`
- `skills/sentry-nextjs-sdk/`
- `skills/sentry-otel-exporter-setup/`
- `skills/sentry-pr-code-review/`
- `skills/sentry-python-sdk/`
- `skills/sentry-react-native-sdk/`
- `skills/sentry-react-sdk/`
- `skills/sentry-ruby-sdk/`
- `skills/sentry-setup-ai-monitoring/`
- `skills/sentry-svelte-sdk/`

Import notes: The repository has no LICENSE file at the pinned commit; Apache-2.0 is declared in README.md, recorded verbatim in SOURCE.md. `sentry-setup-metrics` does not exist upstream at this commit — metrics guidance ships only as per-SDK `references/metrics.md`, which is imported with the Go, Python, and Ruby bundles. `sentry-cocoa-sdk` is excluded (no Forge Swift/Objective-C support) as are `sentry-sdk-skill-creator` and `sentry-create-alert`.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

### wshobson Agents

- Source: https://github.com/wshobson/agents
- Licence: **MIT** (read from `LICENSE`)
- Copyright: Copyright (c) Will Shobson
- Imported release: _no stable release at import time; the reviewed default-branch head is pinned_
- Imported commit: `c4b82b0ad771190355eb8e204b1329732a18449a`
- Files vendored: 65
- Content checksum: `e07343003536b2a318ed44c4791c8e740e5df7f6e8f489aacb454a31987adbda`
- Update policy: reviewed-only

Selected paths:

- `LICENSE`
- `plugins/accessibility-compliance/skills/screen-reader-testing/`
- `plugins/accessibility-compliance/skills/wcag-audit-patterns/`
- `plugins/business-analytics/skills/data-storytelling/`
- `plugins/business-analytics/skills/kpi-dashboard-design/`
- `plugins/cicd-automation/skills/deployment-pipeline-design/`
- `plugins/cicd-automation/skills/github-actions-templates/`
- `plugins/cicd-automation/skills/secrets-management/`
- `plugins/database-design/skills/postgresql/`
- `plugins/developer-essentials/skills/auth-implementation-patterns/`
- `plugins/developer-essentials/skills/e2e-testing-patterns/`
- `plugins/developer-essentials/skills/error-handling-patterns/`
- `plugins/developer-essentials/skills/sql-optimization-patterns/`
- `plugins/documentation-generation/skills/openapi-spec-generation/`
- `plugins/hr-legal-compliance/skills/gdpr-data-handling/`
- `plugins/llm-application-dev/skills/embedding-strategies/`
- `plugins/llm-application-dev/skills/hybrid-search-implementation/`
- `plugins/llm-application-dev/skills/llm-evaluation/`
- `plugins/llm-application-dev/skills/prompt-engineering-patterns/`
- `plugins/llm-application-dev/skills/rag-implementation/`
- `plugins/observability-monitoring/skills/distributed-tracing/`
- `plugins/observability-monitoring/skills/slo-implementation/`
- `plugins/payment-processing/skills/billing-automation/`
- `plugins/payment-processing/skills/paypal-integration/`
- `plugins/payment-processing/skills/pci-compliance/`
- `plugins/payment-processing/skills/stripe-integration/`
- `plugins/security-scanning/skills/attack-tree-construction/`
- `plugins/security-scanning/skills/sast-configuration/`
- `plugins/security-scanning/skills/security-requirement-extraction/`
- `plugins/security-scanning/skills/stride-analysis-patterns/`
- `plugins/security-scanning/skills/threat-mitigation-mapping/`

Excluded paths:

- `**/scripts/`

Import notes: Only the approved subset is imported; the rest of the marketplace, its agents, and its commands are not. `postgresql-table-design` is published as `plugins/database-design/skills/postgresql`. These are supplemental references with no independent routing authority.

Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream skill files are renamed and their activation frontmatter is made inert, upstream command names are rewritten to Forge routes, upstream installation instructions are removed, and update checks and telemetry paths are guarded. Upstream copyright notices are unchanged.

## Apache-2.0 NOTICE obligations

The Impeccable, Google, Cloudflare, and Sentry imports are Apache-2.0. Their NOTICE content, where
upstream provides it, is preserved in each provider directory and redistributed with this package.
Forge does not alter upstream copyright notices, and the modifications listed above are made by
Forge's composition compiler at build time.

## Referenced for concepts only

The following were studied for concepts, interoperability, and audit coverage. No source code,
generated database, brand asset, or substantial prose from them is included in this distribution:
the Agent Skills specification repository (Apache-2.0 code, CC BY 4.0 documentation), Anthropic and
OpenAI skills, Neon Postgres and Auth0 agent skills, Redis agent skills, Microsoft Skills,
AccessLint, Expo Skills, shadcn/ui, and the Vercel web interface guidelines.

Trail of Bits skills (CC BY-SA 4.0) and other share-alike licensed collections are deliberately
**not** vendored, and no protected text from them is adapted here.

The Agent Skills specification and platform names are owned by their respective projects and
vendors. This project is independent and is not endorsed by OpenAI, Anthropic, Google, Cursor,
Windsurf/Devin, GitHub, OWASP, NIST, W3C, or any referenced repository.

Exact URLs, revisions, access dates, scope, and licence handling for the researched sources appear
in `research/SOURCES.md` and `research/LICENSE_MATRIX.md`.

<!-- Generated by scripts/generate-third-party-notices.mjs. Edit that script, not this file. -->
