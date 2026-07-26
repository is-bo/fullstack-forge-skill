# Specification traceability matrix

This matrix restates each authoritative requirement in the maintainers' own words and links it
to repository evidence. It is generated from `config/traceability-matrix.json`; edit the JSON
and run `npm run generate:traceability` rather than editing this file. `npm run check`
fails when the two disagree, when a referenced path is missing, or when a status is
unsupported. See [TRACEABILITY.md](TRACEABILITY.md) for the rules and the review procedure.

Summaries here are original wording. No authoritative source text is quoted or reproduced.

## Requirement count

87 requirements.

## Status summary

- **COMPLIANT**: 49
- **PARTIALLY_COMPLIANT**: 36
- **NOT_VERIFIED**: 2

## Requirements

### FF-ARCH-01

The suite uses progressive disclosure: a small orchestrating entry point, focused modules, one canonical source, generated platform copies, and no symlinks in published output.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/SKILL.md`, `scripts/generate-modules.mjs`, `scripts/package-platforms.mjs`
- **Tests**: `cli/tests/catalog.test.ts`, `scripts/tests/zip.test.mjs`
- **Documentation**: `docs/ARCHITECTURE.md`, `docs/ADDING_A_PLATFORM.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-BRAND-01

Original project artwork exists at the required dimensions and byte budget, documented as AI-assisted and implying no third-party endorsement.

- **Status**: COMPLIANT
- **Implementation**: `docs/assets/fullstack-forge-hero.png`, `docs/assets/fullstack-forge-icon.png`, `scripts/check-branding.mjs`
- **Tests**: `cli/tests/catalog.test.ts`
- **Documentation**: `docs/BRAND.md`, `docs/IMAGE_GENERATION_BRIEF.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-BRAND-02

A correctly dimensioned social preview image is kept in the repository, with exact upload instructions when it cannot be configured programmatically.

- **Status**: NOT_VERIFIED (external)
- **Implementation**: `docs/assets/fullstack-forge-social-preview.png`, `scripts/check-branding.mjs`
- **Tests**: _none_
- **Documentation**: `docs/RELEASING.md`, `docs/BRAND.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Uploading a social preview is a GitHub repository setting performed by a maintainer. The image and instructions are present; the upload itself cannot be proven from repository contents.

### FF-BRAND-03

Before release, branding is validated for working image paths, useful alternative text, reasonable file sizes, and a README that still communicates when images fail.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `scripts/check-branding.mjs`, `scripts/check-links.mjs`
- **Tests**: `scripts/tests/git-files.test.mjs`
- **Documentation**: `docs/BRAND.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Paths, alternative text, and byte budgets are enforced automatically; how GitHub finally renders the images is observed manually and not asserted in CI.

### FF-BUILD-01

Build project and feature state records a complete schema-versioned product frame, lifecycle, selection history, applicability, gates, and evidence without treating recorded planning as proof.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/build.ts`, `cli/src/build-state.ts`, `src/fullstack-forge/schemas/build-project.schema.json`, `src/fullstack-forge/schemas/build-feature.schema.json`
- **Tests**: `cli/tests/build.test.ts`, `cli/tests/build-state.test.ts`
- **Documentation**: `docs/BUILD_MODE.md`, `docs/CLI_REFERENCE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Frame and plan record user or agent inputs; the CLI validates structure and later evidence but cannot grade the quality of product reasoning.

### FF-BUILD-02

A Build PASS is accepted only from an exact registered producer with a typed, current root/revision/input/artifact-bound envelope; unavailable or unsupported producers never pass.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/evidence-envelope.ts`, `cli/src/build-producers.ts`, `cli/src/build-state.ts`
- **Tests**: `cli/tests/evidence-envelope.test.ts`, `cli/tests/build-producers.test.ts`, `cli/tests/build-state.test.ts`
- **Documentation**: `docs/BUILD_MODE.md`, `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: The envelope is a local integrity and freshness record rather than an externally signed attestation.

### FF-BUILD-03

Build applicability and tier gates are derived from current classified evidence and code-owned registries, re-derived before completion, and cannot be weakened by persisted snapshots or a stale project index.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/build-applicability.ts`, `cli/src/build-gates.ts`, `cli/src/build.ts`
- **Tests**: `cli/tests/build-applicability.test.ts`, `cli/tests/build-gates.test.ts`, `cli/tests/build.test.ts`
- **Documentation**: `docs/BUILD_MODE.md`, `docs/ARCHITECTURE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Unknown capabilities stay unresolved; static applicability cannot infer provider or production state.

### FF-BUILD-04

High-tier interface work requires a complete finite state and viewport runtime matrix plus design-direction evidence, while risk decisions are policy-, actor-, root-, revision-, file-, and expiry-bound and never rendered as PASS.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/build-runtime.ts`, `cli/src/build-gates.ts`, `cli/src/build.ts`
- **Tests**: `cli/tests/build-runtime.test.ts`, `cli/tests/build.test.ts`
- **Documentation**: `docs/BUILD_MODE.md`, `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Real browser, assistive-technology, provider, and human design evidence still requires the corresponding environment or reviewer.

### FF-BUILD-05

Legacy v0.2 Build state is upgraded only by an explicit prevalidated, hash-bound, journaled, atomic, resumable, and rollback-capable schema migration that never promotes legacy positive claims.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/build-migration.ts`, `cli/src/build-state.ts`
- **Tests**: `cli/tests/build-migration.test.ts`
- **Documentation**: `docs/BUILD_MODE.md`, `docs/RELEASE_NOTES_v0.1.0.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Migration is intentionally operator-triggered and refuses mixed, malformed, changed, or unsafe state instead of guessing.

### FF-CI-01

Continuous integration runs installation, formatting, lint, type checking, tests, skill validation, synchronization, packaging, smoke tests, secret scanning, dependency review, and licence checks on multiple operating systems with least-privilege, pinned actions.

- **Status**: COMPLIANT
- **Implementation**: `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/release.yml`, `scripts/check-workflows.mjs`
- **Tests**: `scripts/tests/workflow-policy.test.mjs`
- **Documentation**: `docs/DEVELOPMENT.md`, `docs/RELEASING.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-CLI-01

The CLI installs, updates, validates, diagnoses, packages, and uninstalls across operating systems without symlinks, with dry-run and JSON output, an installation manifest, and ownership-restricted removal.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/installer.ts`, `cli/src/cli.ts`, `cli/src/constants.ts`
- **Tests**: `cli/tests/installer.test.ts`, `cli/tests/cli.test.ts`
- **Documentation**: `docs/CLI_REFERENCE.md`, `README.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-CMD-01

Every focused section supports read-only audit, approval-gated fix, re-checking verify, and structured report modes.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/cli.ts`, `cli/src/fixes.ts`, `cli/src/verification.ts`, `cli/src/report.ts`, `cli/src/report-output.ts`
- **Tests**: `cli/tests/cli.test.ts`, `cli/tests/fixes.test.ts`, `cli/tests/report.test.ts`, `cli/tests/report-output.test.ts`, `cli/tests/cli-report-mode.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `docs/CLI_REFERENCE.md`, `docs/REPORT_SCHEMA.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-CMD-02

A fixed catalogue of focused audit modules exists, and each module teaches a concrete inspection procedure instead of generic advice.

- **Status**: COMPLIANT
- **Implementation**: `config/modules.json`, `config/module-procedures.json`, `src/fullstack-forge/commands`
- **Tests**: `cli/tests/catalog.test.ts`, `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `docs/ADDING_A_MODULE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-DISC-01

Discovery profiles the audited project — languages, frameworks, workspaces, applications, data stores, routes, roles, tenancy, jobs, integrations, hosting, and deployment — with confidence and evidence, and writes a reusable profile and architecture map.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/discovery.ts`, `cli/src/discovery-evidence.ts`, `src/fullstack-forge/schemas/project-profile.schema.json`
- **Tests**: `cli/tests/discovery.test.ts`, `cli/tests/discovery-evidence.test.ts`
- **Documentation**: `docs/ARCHITECTURE.md`, `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Runtime topology and middleware-inherited route visibility remain unproven by static discovery and are reported as unknown rather than assumed.

### FF-DIST-01

Platform copies are generated from one canonical source, committed, and continuously checked so that drift fails the build.

- **Status**: COMPLIANT
- **Implementation**: `scripts/generate-modules.mjs`, `scripts/sync-platform-assets.mjs`, `scripts/check-platform-assets.mjs`
- **Tests**: `cli/tests/catalog.test.ts`
- **Documentation**: `docs/PLATFORM_SUPPORT.md`, `docs/ADDING_A_PLATFORM.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-DIST-02

Distribution archives contain real files, exclude dependencies, temporary material, and secrets, install from a clean directory, are deterministic, and ship with checksums.

- **Status**: COMPLIANT
- **Implementation**: `scripts/package-platforms.mjs`, `scripts/validate-dist.mjs`, `scripts/lib/zip.mjs`, `scripts/smoke-install.mjs`, `scripts/offline-install.mjs`
- **Tests**: `scripts/tests/zip.test.mjs`, `scripts/tests/smoke-install.test.mjs`
- **Documentation**: `docs/RELEASING.md`, `docs/PLATFORM_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-DOCS-01

The README explains the product, audience, capabilities, installation, invocation, verification honesty, contribution path, and limitations without requiring source reading, and uses only real badges.

- **Status**: COMPLIANT
- **Implementation**: `README.md`
- **Tests**: `scripts/tests/git-files.test.mjs`
- **Documentation**: `docs/COMMANDS.md`, `docs/CLI_REFERENCE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-DOCS-02

Editable diagrams explain the audit workflow and the command architecture.

- **Status**: COMPLIANT
- **Implementation**: `README.md`, `src/fullstack-forge/templates/architecture-map.md`
- **Tests**: _none_
- **Documentation**: `docs/ARCHITECTURE.md`
- **Release verification**: _none_
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-DOCS-03

A complete documentation set covers commands, architecture, platform support, the finding schema, the security model, module and platform extension, releasing, contribution, conduct, security reporting, and change history.

- **Status**: COMPLIANT
- **Implementation**: `scripts/check-install-docs.mjs`, `scripts/validate-release-docs.mjs`
- **Tests**: `scripts/tests/release-safety.test.mjs`
- **Documentation**: `docs/COMMANDS.md`, `docs/ARCHITECTURE.md`, `docs/PLATFORM_SUPPORT.md`, `docs/FINDING_SCHEMA.md`, `docs/SECURITY_MODEL.md`, `docs/ADDING_A_MODULE.md`, `docs/ADDING_A_PLATFORM.md`, `docs/RELEASING.md`, `docs/IMAGE_GENERATION_BRIEF.md`, `CHANGELOG.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-EVID-01

One shared finding schema carries identity, severity, confidence, status, location, evidence, impact, recommendation, fix safety, verification, and standards; a pass requires direct evidence and unverifiable results must say so.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/finding.ts`, `cli/src/types.ts`, `src/fullstack-forge/schemas/finding.schema.json`
- **Tests**: `cli/tests/finding.test.ts`, `cli/tests/report.test.ts`
- **Documentation**: `docs/FINDING_SCHEMA.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-EVID-02

Every module carries a completion contract: written code is never sufficient, and failed or skipped checks must be reported rather than hidden.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/references/PROTOCOL.md`, `src/fullstack-forge/SKILL.md`
- **Tests**: `cli/tests/catalog.test.ts`, `cli/tests/semantics.test.ts`
- **Documentation**: `docs/FINDING_SCHEMA.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-FIX-01

Automatic fixes are restricted to a declared safe set; destructive, architectural, financial, and security-weakening changes require explicit approval.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/fixes.ts`, `src/fullstack-forge/references/SAFE_FIX_POLICY.md`
- **Tests**: `cli/tests/fixes.test.ts`
- **Documentation**: `docs/SECURITY_MODEL.md`, `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-GOV-01

All work targets one authoritative public repository; no parallel or renamed repository is used for distribution.

- **Status**: COMPLIANT
- **Implementation**: `package.json`, `scripts/release-preflight.mjs`
- **Tests**: `scripts/tests/release-safety.test.mjs`
- **Documentation**: `docs/RELEASING.md`, `CONTRIBUTING.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-GOV-02

The project ships under a fixed identity: product name, skill name, CLI name and alias, license, language, and Node.js baseline.

- **Status**: COMPLIANT
- **Implementation**: `package.json`, `skill.json`
- **Tests**: `cli/tests/catalog.test.ts`
- **Documentation**: `README.md`, `docs/BRAND.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-GOV-03

Every advertised capability must be working software rather than placeholders, pseudocode, or documentation-only promises.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `cli/src/cli.ts`, `cli/src/inspectors.ts`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/cli.test.ts`, `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`, `docs/COVERAGE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Several audit modules provide a documented inspection procedure with only partial executable analyzer coverage; the executable/partial/none split is published in docs/ANALYZER_SUPPORT.md rather than being claimed as complete automation.

### FF-GOV-04

The tool must never expose credentials, tokens, environment secrets, or unrelated local content from an audited project.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/redaction.ts`, `cli/src/net-policy.ts`, `scripts/secret-scan.mjs`
- **Tests**: `cli/tests/redaction.test.ts`, `cli/tests/net-policy.test.ts`
- **Documentation**: `docs/SECURITY_MODEL.md`, `SECURITY.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-GOV-05

Version-control history uses clear conventional commits rather than noise commits per file.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `.github/pull_request_template.md`
- **Tests**: _none_
- **Documentation**: `CONTRIBUTING.md`, `docs/DEVELOPMENT.md`
- **Release verification**: _none_
- **Pending integration**: _none_
- **Limitations**: Commit-message shape is documented and reviewed, but no automated commit-lint gate runs in CI.

### FF-GOV-06

The public repository surface carries a description, topics, issue templates, a pull-request template, a security policy, contribution guidance, and a code of conduct.

- **Status**: NOT_VERIFIED (external)
- **Implementation**: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/audit_module.yml`, `.github/pull_request_template.md`
- **Tests**: _none_
- **Documentation**: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Repository description and topics are GitHub-hosted settings. They cannot be proven from repository contents, so this entry stays NOT_VERIFIED until a maintainer records a GitHub-side check.

### FF-MOD-01

Requirements and domain logic are inspected for missing, contradictory, or unverifiable business behaviour, including money, dates, ownership, and irreversible actions.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-requirements`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Requirement conformance is a guided manual procedure; no executable analyzer proves domain correctness.

### FF-MOD-02

Architecture is inspected for boundaries, dependency direction, coupling, hidden shared state, and both under- and over-engineering.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-architecture`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/ARCHITECTURE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Architecture judgements are procedure-driven; the architecture map records candidate boundaries, not proven runtime calls.

### FF-MOD-03

Code quality is inspected for type safety, error handling, dead code, leaks, and maintainability using the project's own tooling where available.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-code`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Analyzer coverage is language- and framework-bounded; unsupported shapes are reported as NOT_VERIFIED instead of PASS.

### FF-MOD-04

Visual-interface creation and review activates automatically, preserves established product conventions, loads focused guidance proportionately, and uses rendered evidence rather than source inference across relevant states and viewports.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-ui`, `src/fullstack-forge/references/frontend`, `cli/src/frontend-routing.ts`, `cli/src/rendered-ui.ts`, `cli/src/audit-orchestration.ts`
- **Tests**: `cli/tests/frontend-routing.test.ts`, `cli/tests/rendered-ui.test.ts`, `cli/tests/rendered-ui-capture.test.ts`, `cli/tests/cli-audit-orchestration.test.ts`, `cli/tests/cross-feature-v017-v019.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `docs/SECURITY_MODEL.md`, `docs/CLI_REFERENCE.md`, `research/FRONTEND_UI_UX_SYSTEM.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Rendered inspection requires an application the operator has already started and an explicitly authorised trusted browser driver. Forge never launches an application and never installs browser tooling, so where no driver is available the rendered criteria remain NOT_VERIFIED and the audit exits 2 rather than reporting a pass.

### FF-MOD-05

User experience activates automatically for journeys and evaluates the named user task, system states, input preservation, adverse paths, and recovery without presenting expert hypotheses as user research.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-ux`, `src/fullstack-forge/references/frontend/product-and-ux.md`, `src/fullstack-forge/references/frontend/forms-and-data-entry.md`, `cli/src/frontend-routing.ts`
- **Tests**: `cli/tests/semantics.test.ts`, `cli/tests/frontend-routing.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `research/FRONTEND_UI_UX_SYSTEM.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Journey evaluation is a guided manual procedure with no executable analyzer.

### FF-MOD-06

Accessibility is inspected against WCAG 2.2 AA, and automated scanning is never presented as a complete audit.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-accessibility`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Assistive-technology behaviour requires human confirmation and is reported as NOT_VERIFIED when unavailable.

### FF-MOD-07

Localization is inspected for hard-coded strings, formatting, pluralization, expansion, fallbacks, and bidirectional layout.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-i18n`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Translation completeness depends on project-specific catalogues and is not proven automatically.

### FF-MOD-08

Search-engine and discoverability checks apply only to genuinely public web surfaces and are otherwise marked not applicable.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-seo`, `cli/src/gates.ts`
- **Tests**: `cli/tests/gate-applicability.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-MOD-09

Frontend implementation and review activates automatically, routes through a concise orchestrator and focused local references, and covers rendering boundaries, state, networks, hydration, composition, delivery, and measured performance.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-frontend`, `src/fullstack-forge/references/frontend`, `config/frontend-system.json`, `cli/src/frontend-routing.ts`
- **Tests**: `cli/tests/semantics.test.ts`, `cli/tests/frontend-routing.test.ts`, `cli/tests/cli-simple.test.ts`, `scripts/check-frontend-system.mjs`
- **Documentation**: `docs/COMMANDS.md`, `research/FRONTEND_UI_UX_SYSTEM.md`, `research/SOURCES.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Bundle and runtime measurements require a project build and are otherwise NOT_VERIFIED.

### FF-MOD-10

Application interfaces are inspected for contract consistency, validation, authorization, pagination, errors, and idempotency.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-api`, `cli/src/inspectors.ts`
- **Tests**: `cli/tests/route-adapters.test.ts`, `cli/tests/adapter-coverage.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Route adapters cover a bounded set of frameworks; unsupported registration shapes are declared rather than silently skipped.

### FF-MOD-11

Queued and scheduled work is inspected for idempotency, retries, dead-letter handling, ordering, and operability.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-jobs`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Runtime queue behaviour cannot be proven statically and is reported as NOT_VERIFIED.

### FF-MOD-12

Outbound and inbound integrations are inspected for timeouts, retries, signature verification, replay safety, and failure isolation.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-integrations`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Provider-side controls are outside the repository and remain NOT_VERIFIED.

### FF-MOD-13

Identity handling is inspected across registration, credentials, sessions, recovery, federation, and reauthentication, without recommending bespoke cryptography.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-auth`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Provider-hosted authentication configuration cannot be proven from source and stays NOT_VERIFIED.

### FF-MOD-14

Authorization is audited separately from authentication, requires deny-by-default server-side enforcement on every path, and produces negative tests.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-authorization`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/gates.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`, `docs/FINDING_SCHEMA.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Middleware-inherited guards are not resolved statically; affected routes stay unknown rather than passing.

### FF-MOD-15

General application security is audited across injection, browser controls, secrets, cryptography, abuse cases, and dependency risk.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-security`, `cli/src/analyzers.ts`, `cli/src/dataflow.ts`, `cli/src/destination-policy.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/dataflow.test.ts`, `cli/tests/security-proof.test.ts`
- **Documentation**: `docs/SECURITY_MODEL.md`, `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Static analysis covers a declared rule set with declared unsupported shapes, published in docs/ANALYZER_SUPPORT.md. Protection is credited only from analysed structure: a constant-returning address guard, and a guard imported from another module, are recorded as unverified rather than credited, which under-credits genuine mitigations by design.

### FF-MOD-16

File uploads receive a dedicated audit covering validation, malware handling, storage isolation, media and document parsing, downloads, abuse limits, and lifecycle.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-uploads`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Scanner and storage-provider behaviour is external and reported as NOT_VERIFIED unless directly evidenced.

### FF-MOD-17

Privacy is audited beyond protection: whether personal data should have been collected, retained, exported, or deleted at all.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-privacy`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Purpose and lawful basis are organizational facts that cannot be derived from source.

### FF-MOD-18

Tenant isolation is verified across data, cache, files, jobs, logs, exports, and administration, with cross-tenant tests recommended or created.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-tenancy`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Runtime tenant propagation is not proven statically; isolation stays NOT_VERIFIED without executed tests.

### FF-MOD-19

Database schemas are inspected for integrity constraints, typing, money and time representation, tenancy, migration history, and safe evolution.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-database`, `cli/src/inspectors.ts`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Applied production schema state is not readable from the repository and stays NOT_VERIFIED.

### FF-MOD-20

Data access is inspected for N+1 patterns, missing indexes, unbounded reads, locking, and non-deterministic ordering, and query-plan analysis never runs against production.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-queries`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`, `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Plan analysis requires an operator-provided non-production database and is otherwise NOT_VERIFIED.

### FF-MOD-21

Caching is first justified, then audited for keys, isolation, invalidation, poisoning, and failure behaviour; concluding that a cache is unnecessary is a valid result.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-cache`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-MOD-22

Object and file storage is inspected for access control, signed-URL safety, encryption, lifecycle, orphans, and environment isolation.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-storage`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Bucket-side policy is provider state and stays NOT_VERIFIED without operator evidence.

### FF-MOD-23

Test adequacy is judged by risk coverage across units, boundaries, workflows, and failure modes rather than by line coverage alone.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-testing`, `scripts/run-coverage.mjs`
- **Tests**: `scripts/tests/coverage.test.mjs`
- **Documentation**: `docs/COVERAGE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-MOD-24

Performance is measured rather than guessed, across user-visible latency, payloads, resource use, and slow devices.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-performance`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Field measurements require a running application; unmeasured claims are reported as NOT_VERIFIED.

### FF-MOD-25

Capacity and growth limits are assessed against explicit demand assumptions, and additional infrastructure is never recommended without evidence.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-scale`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Demand assumptions are operator inputs and cannot be derived from the repository.

### FF-MOD-26

Telemetry is inspected for structured logs, correlation, metrics, traces, alerting, redaction, and retention.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-observability`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Dashboard and alert configuration lives in external systems and stays NOT_VERIFIED.

### FF-MOD-27

Reliability is inspected for timeouts, retries, overload behaviour, degradation, health signalling, and stated objectives.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-reliability`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Failure behaviour under real outages cannot be proven statically.

### FF-MOD-28

Backup and disaster recovery must never pass on configuration alone; restoration has to be tested or directly evidenced, otherwise the result is not verified.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-recovery`, `cli/src/gates.ts`
- **Tests**: `cli/tests/gates.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/FINDING_SCHEMA.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-MOD-29

Delivery is inspected for build promotion, environment separation, migration ordering, rollout, rollback, and post-deployment verification.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-deployment`, `cli/src/inspectors.ts`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Production deployment configuration is external and stays NOT_VERIFIED.

### FF-MOD-30

Infrastructure definitions are inspected for network exposure, identity boundaries, encryption, resource limits, and drift.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-infrastructure`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Live cloud state is not readable from the repository; drift stays NOT_VERIFIED.

### FF-MOD-31

The delivery chain is inspected for vulnerable and unpinned dependencies, install scripts, build integrity, action pinning, licensing, and release provenance.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-supply-chain`, `scripts/check-workflows.mjs`, `scripts/lib/workflow-policy.mjs`
- **Tests**: `scripts/tests/workflow-policy.test.mjs`
- **Documentation**: `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-MOD-32

Resource and vendor cost is tied to workloads, ownership, unit economics, and safe optimization choices.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-cost`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Billing data is external and cannot be proven from the repository.

### FF-MOD-33

Project documentation is verified to be accurate and executable rather than aspirational.

- **Status**: COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-docs`, `scripts/check-links.mjs`, `scripts/check-install-docs.mjs`
- **Tests**: `scripts/tests/git-files.test.mjs`
- **Documentation**: `docs/DEVELOPMENT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-MOD-34

Product analytics is inspected for event semantics, duplication, identity, consent, sensitive data, and schema versioning.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-analytics`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Delivered event streams live in external systems and stay NOT_VERIFIED.

### FF-MOD-35

Notifications are inspected for authorization, preferences, duplicate sends, retries, localization, sensitive content, and deliverability.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-notifications`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Provider delivery outcomes are external and stay NOT_VERIFIED.

### FF-MOD-36

AI features are audited for direct and indirect prompt injection, tool authority, tenant isolation, output validation, cost controls, and mandatory human confirmation before irreversible actions.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-ai`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Model-side behaviour and evaluation results are external and stay NOT_VERIFIED.

### FF-MOD-37

Money movement is audited for server-side amounts, currency precision, webhook signatures, idempotency, reconciliation, and replay safety.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-payments`, `cli/src/analyzers.ts`
- **Tests**: `cli/tests/analyzers.test.ts`, `cli/tests/evals.test.ts`
- **Documentation**: `docs/ANALYZER_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Provider dashboard configuration and settlement data are external and stay NOT_VERIFIED.

### FF-MOD-38

Real-time transports are inspected for authorization, lifecycle, ordering, tenant channel separation, abuse limits, and recovery.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-realtime`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Connection-time authorization is not provable from static source alone.

### FF-MOD-39

Offline-capable applications are inspected for local persistence, queued writes, synchronization, conflicts, revocation, and logout cleanup.

- **Status**: PARTIALLY_COMPLIANT
- **Implementation**: `src/fullstack-forge/commands/forge-offline`
- **Tests**: `cli/tests/semantics.test.ts`
- **Documentation**: `docs/COMMANDS.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Device-side synchronization behaviour requires runtime evidence.

### FF-ORCH-01

A repository-wide orchestrator runs discovery, selects applicable modules, merges duplicate findings while preserving evidence, ranks remediation, and marks blocked or unverified checks.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/cli.ts`, `cli/src/scope.ts`, `cli/src/report.ts`, `cli/src/audit-orchestration.ts`, `cli/src/ledger.ts`
- **Tests**: `cli/tests/cli.test.ts`, `cli/tests/scope.test.ts`, `cli/tests/scope-base.test.ts`, `cli/tests/module-decision.test.ts`, `cli/tests/audit-orchestration.test.ts`, `cli/tests/ledger.test.ts`, `cli/tests/cross-feature-v017-v019.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `docs/ARCHITECTURE.md`, `docs/REPORT_SCHEMA.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-PRODUCT-01

One simple Forge entry point exposes build, continue, audit, fix, verify, ship, status, and help while preserving the complete expert command surface.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/simple-cli.ts`, `cli/src/cli.ts`, `src/fullstack-forge/commands/forge/SKILL.md`
- **Tests**: `cli/tests/simple-cli.test.ts`, `cli/tests/cli-simple.test.ts`
- **Documentation**: `README.md`, `docs/ARCHITECTURE.md`, `docs/ADVANCED_CLI.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Host applications choose their own named-skill invocation syntax; the generated skill and CLI mappings are verified, while host UI rendering remains platform-dependent.

### FF-PRODUCT-02

Plain-language Build input creates a safe collision-resistant feature frame, and Continue resumes one unfinished feature but refuses to guess among several.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/simple-cli.ts`, `cli/src/cli.ts`, `cli/src/build.ts`
- **Tests**: `cli/tests/simple-cli.test.ts`, `cli/tests/cli-simple.test.ts`
- **Documentation**: `docs/BUILD_YOUR_FIRST_FEATURE.md`, `docs/BUILD_MODE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Product questions still require user or agent judgement; framing records intent but is not evidence that the resulting feature is correct.

### FF-PRODUCT-03

Simple Audit accepts official and transparent plain-language discipline requests, can run explicit composite areas, chooses changed scope only from a reliable Git base, and keeps incomplete evidence non-successful.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/simple-cli.ts`, `cli/src/cli.ts`, `cli/src/verification.ts`
- **Tests**: `cli/tests/simple-cli.test.ts`, `cli/tests/cli-simple.test.ts`
- **Documentation**: `docs/AUDIT_YOUR_APPLICATION.md`, `docs/NONTECHNICAL_GUIDE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Ambiguous phrases remain errors rather than guesses; unavailable runtime, provider, production, and host evidence remains NOT_VERIFIED or BLOCKED.

### FF-PRODUCT-04

The default terminal experience is concise, keyboard-friendly, scriptable, and progressively discloses technical reports, JSON, finding evidence, and exact next actions.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/simple-cli.ts`, `cli/src/cli.ts`
- **Tests**: `cli/tests/simple-cli.test.ts`, `cli/tests/cli-simple.test.ts`
- **Documentation**: `README.md`, `docs/GETTING_STARTED.md`, `docs/NONTECHNICAL_GUIDE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Terminal interactivity is optional and disabled automatically when standard input or output is not a TTY.

### FF-PRODUCT-05

Installation detects finite compatible configuration and executable-name hints without running them, recommends bounded selectors, reports first commands, survives interruption without losing ownership, and Doctor checks bundle, install, project, report, and update health with repairs.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/agent-detection.ts`, `cli/src/installer.ts`, `cli/src/update-check.ts`, `cli/src/cli.ts`
- **Tests**: `cli/tests/agent-detection.test.ts`, `cli/tests/installer.test.ts`, `cli/tests/update-check.test.ts`, `cli/tests/cli-simple.test.ts`
- **Documentation**: `docs/GETTING_STARTED.md`, `docs/TROUBLESHOOTING.md`, `docs/PLATFORM_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Configuration and executable-name hints are recommendations, not proof that a vendor host is installed or running; remote update lookup is a non-passing warning when offline or unavailable.

### FF-PRODUCT-06

A deterministic onboarding demo proves the simple Audit, fix preview, safe fix, Verify, and fail-closed Ship journey in under ten minutes.

- **Status**: COMPLIANT
- **Implementation**: `examples/quickstart-demo`
- **Tests**: `cli/tests/cli-simple.test.ts`
- **Documentation**: `examples/quickstart-demo/README.md`, `docs/GETTING_STARTED.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: The demo intentionally cannot supply remote CI, deployment, provider, or production evidence, so Ship is expected to remain incomplete.

### FF-REL-01

Before publication a fixed validation sequence runs formatting, lint, typing, tests, skill validation, synchronization, packaging, archive validation, installation tests, secret scanning, attribution checks, and link resolution.

- **Status**: COMPLIANT
- **Implementation**: `package.json`, `scripts/validate-skill.mjs`, `scripts/validate-dist.mjs`, `scripts/release-preflight.mjs`
- **Tests**: `scripts/tests/release-safety.test.mjs`, `scripts/tests/smoke-install.test.mjs`
- **Documentation**: `docs/RELEASING.md`, `docs/RELEASE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-REL-02

Publication is proven rather than asserted: the remote commit, workflow status, tag, release, attached archives, and checksums are verified after the fact.

- **Status**: COMPLIANT
- **Implementation**: `scripts/verify-published-assets.mjs`, `scripts/release-preflight.mjs`, `scripts/generate-final-verification.mjs`
- **Tests**: `scripts/tests/release-safety.test.mjs`
- **Documentation**: `docs/RELEASING.md`, `docs/RELEASE_NOTES_v0.1.0.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Publication to the public package registry is optional by design and has not been performed; only the source release is verified.

### FF-REL-03

After publication, installation is re-tested from the published artifacts in a clean temporary environment across supported agent targets, and the outcome is recorded in a versioned verification document.

- **Status**: COMPLIANT
- **Implementation**: `scripts/smoke-install.mjs`, `scripts/offline-install.mjs`
- **Tests**: `scripts/tests/smoke-install.test.mjs`
- **Documentation**: `docs/RELEASING.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`, `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-REL-04

The closing report states repository, release, version, commit, platforms, commands, test results, verification outcome, artifacts, limitations, and any genuinely blocked action, and never claims unverified success.

- **Status**: COMPLIANT
- **Implementation**: `scripts/generate-final-verification.mjs`, `scripts/validate-release-docs.mjs`
- **Tests**: `scripts/tests/release-safety.test.mjs`
- **Documentation**: `docs/RELEASE.md`, `docs/RELEASE_NOTES_v0.1.0.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-RES-01

Agent platform formats and installation conventions are researched from primary sources before generation targets are chosen.

- **Status**: COMPLIANT
- **Implementation**: `scripts/sync-platform-assets.mjs`, `scripts/check-platform-assets.mjs`
- **Tests**: `cli/tests/catalog.test.ts`
- **Documentation**: `research/SOURCES.md`, `docs/PLATFORM_SUPPORT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-RES-02

Audit content is grounded in neutral engineering and security standards rather than vendor marketing.

- **Status**: COMPLIANT
- **Implementation**: `config/modules.json`, `config/module-criteria.json`
- **Tests**: `cli/tests/catalog.test.ts`
- **Documentation**: `research/SOURCES.md`
- **Release verification**: _none_
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-RES-03

Third-party material is treated as untrusted, never wholesale copied, and fully attributed with a license-compatibility record.

- **Status**: COMPLIANT
- **Implementation**: `scripts/check-licenses.mjs`
- **Tests**: `scripts/tests/git-files.test.mjs`
- **Documentation**: `research/LICENSE_MATRIX.md`, `research/ADAPTATION_NOTES.md`, `THIRD_PARTY_NOTICES.md`, `NOTICE`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-SEC-01

The project audits itself for unsafe execution, traversal, archive and symlink attacks, secret leakage, unsafe update or uninstall behaviour, and prompt injection from audited repositories, and publishes the resulting threat model.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/utils.ts`, `cli/src/installer.ts`, `cli/src/net-policy.ts`, `scripts/lib/fs-safety.mjs`, `scripts/secret-scan.mjs`
- **Tests**: `cli/tests/utils.test.ts`, `cli/tests/installer.test.ts`, `cli/tests/net-policy.test.ts`, `scripts/tests/fs-safety.test.mjs`
- **Documentation**: `docs/SECURITY_MODEL.md`, `SECURITY.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-SHIP-01

A release-readiness gate fails closed on open critical findings, failed required checks, out-of-sync generated copies, unverified high-risk areas, incomplete packaging, or failed installation tests.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/gates.ts`, `cli/src/support.ts`, `src/fullstack-forge/checklists/ship.md`
- **Tests**: `cli/tests/gates.test.ts`, `cli/tests/gate-applicability.test.ts`, `cli/tests/support.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `docs/RELEASE.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-SHIP-02

Ship derives current inspection and command evidence at a stable working-tree revision, treats persisted reports as diagnostics only, verifies registered envelopes, and rejects Build-domain evidence.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/gates.ts`, `cli/src/evidence-envelope.ts`
- **Tests**: `cli/tests/gates.test.ts`, `cli/tests/ship-rederivation.test.ts`
- **Documentation**: `docs/COMMANDS.md`, `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: Remote CI, registry, hosting, provider, production, provenance, and immutable-release state require separate direct evidence.

### FF-TEST-01

Deliberately flawed fixture projects and evaluation cases confirm that the declared defect classes are actually detected, without faking automated guarantees where detection is not deterministic.

- **Status**: COMPLIANT
- **Implementation**: `fixtures`, `evals/cases.json`, `evals/v030-build-mode`, `evals/v030-prevention`, `scripts/check-fixtures.mjs`, `scripts/lib/fixture-manifests.mjs`
- **Tests**: `cli/tests/evals.test.ts`, `cli/tests/v030-build-mode-evals.test.ts`, `cli/tests/v030-prevention-evals.test.ts`, `cli/tests/discovery.test.ts`, `scripts/tests/fixture-manifests.test.mjs`
- **Documentation**: `fixtures/README.md`, `evals/README.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-TEST-02

Automated tests cover skill metadata, the command registry, the finding schema, reporting, CLI parsing, install and uninstall lifecycles, dry-run and JSON output, platform generation, archive contents, path-traversal protection, and cross-platform paths.

- **Status**: COMPLIANT
- **Implementation**: `scripts/run-coverage.mjs`, `config/coverage-thresholds.json`
- **Tests**: `cli/tests/catalog.test.ts`, `cli/tests/cli.test.ts`, `cli/tests/installer.test.ts`, `cli/tests/finding.test.ts`, `cli/tests/report.test.ts`, `cli/tests/utils.test.ts`, `scripts/tests/fs-safety.test.mjs`, `scripts/tests/zip.test.mjs`
- **Documentation**: `docs/COVERAGE.md`, `docs/DEVELOPMENT.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_

### FF-TOOL-01

Inspection is performed by real executable tools that detect commands before running them, use argument arrays, apply timeouts, and restrict working directories.

- **Status**: COMPLIANT
- **Implementation**: `cli/src/tools.ts`, `cli/src/inspectors.ts`, `cli/src/utils.ts`
- **Tests**: `cli/tests/utils.test.ts`, `cli/tests/cli.test.ts`, `scripts/tests/fs-safety.test.mjs`
- **Documentation**: `docs/CLI_REFERENCE.md`, `docs/SECURITY_MODEL.md`
- **Release verification**: `docs/RELEASE_VERIFICATION_v0.1.0.md`
- **Pending integration**: _none_
- **Limitations**: _none_
