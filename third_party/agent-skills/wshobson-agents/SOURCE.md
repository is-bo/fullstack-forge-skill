# wshobson Agents

Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is
a pristine copy of the selected upstream files: Forge never edits it in place. Runtime
adaptations are applied by the composition compiler from declared overlays and transforms.

| Field | Value |
| --- | --- |
| Repository | `wshobson/agents` |
| Upstream commit | `c4b82b0ad771190355eb8e204b1329732a18449a` |
| Upstream tag | _none — pinned default-branch head_ |
| Licence | MIT |
| Licence evidence | `LICENSE` |
| Files imported | 65 |
| Content checksum | `e07343003536b2a318ed44c4791c8e740e5df7f6e8f489aacb454a31987adbda` |
| Update policy | reviewed-only |

## Selected paths

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

## Excluded paths

- `**/scripts/`

## Import notes

Only the approved subset is imported; the rest of the marketplace, its agents, and its commands are not. `postgresql-table-design` is published as `plugins/database-design/skills/postgresql`. These are supplemental references with no independent routing authority.

## Instruction review

The automated screen recorded the hits below. Each was reviewed against Forge's approval boundaries; guidance that merely *describes* an operation is advisory, and no vendored instruction can bypass a Forge contract at runtime.

- `global-install` — `plugins/documentation-generation/skills/openapi-spec-generation/references/code-first-and-tooling.md`: ing ```bash # Install validation tools npm install -g @stoplight/spectral-cli npm install -g @redocly/cli # Spectral r
- `global-install` — `plugins/documentation-generation/skills/openapi-spec-generation/references/code-first-and-tooling.md`: npm install -g @stoplight/spectral-cli npm install -g @redocly/cli # Spectral ruleset (.spectral.yaml) cat > .spectral
- `global-install` — `plugins/documentation-generation/skills/openapi-spec-generation/references/code-first-and-tooling.md`: Generation ```bash # OpenAPI Generator npm install -g @openapitools/openapi-generator-cli # Generate TypeScript client
- `foreign-skill-install` **(hard-deny rule)** — `plugins/documentation-generation/skills/openapi-spec-generation/references/code-first-and-tooling.md`: ing ```bash # Install validation tools npm install -g @stoplight/spectral-cli npm install -g @redocly/cli # Spectral r
- `foreign-skill-install` **(hard-deny rule)** — `plugins/documentation-generation/skills/openapi-spec-generation/references/code-first-and-tooling.md`: npm install -g @stoplight/spectral-cli npm install -g @redocly/cli # Spectral ruleset (.spectral.yaml) cat > .spectral
- `foreign-skill-install` **(hard-deny rule)** — `plugins/documentation-generation/skills/openapi-spec-generation/references/code-first-and-tooling.md`: Generation ```bash # OpenAPI Generator npm install -g @openapitools/openapi-generator-cli # Generate TypeScript client

## Attribution

Copyright (c) 2024 Seth Hobson. Licensed under MIT.
The upstream maintainers do not endorse Fullstack Forge.
