# Turn your AI coding agent into a production-focused full-stack engineer

[![Release](https://img.shields.io/github/v/release/is-bo/fullstack-forge-skill)](https://github.com/is-bo/fullstack-forge-skill/releases)
[![CI](https://github.com/is-bo/fullstack-forge-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/is-bo/fullstack-forge-skill/actions/workflows/ci.yml)

Fullstack Forge makes AI coding agents build production-ready applications by default.

Install Fullstack Forge in your project and continue working normally. When you ask your AI agent to
add a feature, fix a bug, refactor code, improve performance, or prepare a release, Forge
automatically guides it through the relevant architecture, security, data, API, UI, testing,
reliability, and operational practices. Explicit Forge commands remain available, but they are
optional.

Fullstack Forge is not a standalone universal scanner. It is 42 agent-guided production engineering
modules with deterministic automation where supported.

## Install

Node.js 24 or newer is required.

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.1.0"
npx forge init
npx forge doctor
```

Continue working with your AI agent normally. Forge activates automatically for software-engineering
tasks.

`forge init` detects configured agents and installs the complete skill bundle plus ownership-safe
project instructions. `forge init all` remains available when you intentionally want every supported
platform.

## Automatic use

```text
User:
Add a feature that lets doctors cancel appointments and notify patients.

Agent with Fullstack Forge:
- Inspects the existing appointment and notification architecture.
- Applies the API, database, authorization, notification, UX, and testing modules.
- Implements cancellation reasons and status transitions.
- Prevents unauthorised cancellation.
- Adds notification failure handling.
- Adds focused tests.
- Runs typechecks and relevant test suites.
- Reports what passed and what remains unverified.
```

No Forge command was required.

## Agent-first frontend, UI, and UX

Install Fullstack Forge and continue working normally. When you ask your AI agent to build or
improve an interface, it automatically applies the relevant frontend, UI, UX, accessibility, and
performance guidance. The agent inspects the product and existing design first, preserves useful
conventions, loads only matching progressive references, implements the work, and inspects the
rendered result when tools are available.

```text
User:
Create a mobile-friendly appointment booking flow.

Agent with Forge:
- Inspects the product, routes, components, tokens, and existing booking behavior.
- Applies UX, UI, frontend, and accessibility guidance automatically.
- Defines a product-appropriate visual direction for substantial new work.
- Implements loading, partial, empty, error, success, permission, and offline states as applicable.
- Checks narrow and wide layouts, input preservation, recovery, and keyboard behavior.
- Runs focused project checks and reports exactly what was and was not verified.
```

No Forge command is required. The canonical `forge-frontend` orchestrator routes to focused product,
visual, system, responsive, component, framework, performance, motion, forms, data-visualization,
mobile, review, and anti-pattern references. Mobile, chart, motion, and framework guidance stays out
of context unless the request or repository proves it relevant.

This is agent-guided frontend engineering, UI design, and UX review with deterministic automation
where supported. The CLI does not automate product judgment or imply rendered validation.

The default workflow is:

```text
UNDERSTAND → DISCOVER → SELECT → PLAN → IMPLEMENT → INSPECT → VERIFY → REPORT
```

Discovery heuristics are hints, not truth. Generated Forge files never prove that the application
uses a capability, and the agent loads only modules supported by the request or direct project
evidence.

## Proportional by default

- A small wording, styling, or isolated UI change gets focused inspection and validation, not a
  repository audit.
- A normal form, endpoint, CRUD flow, notification, or dashboard feature gets a brief plan, relevant
  playbooks, tests, focused checks, and one final relevant pass.
- Authentication, authorization, payments, personal data, uploads, destructive migrations,
  subscriptions, secrets, and security-sensitive caching receive stronger evidence and completion
  gates.

Forge does not treat every task as high risk, repeatedly run the full suite, recommend Redis or new
infrastructure without evidence, or claim production readiness without proof.

## Responsibilities

| Layer         | Responsibility                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| AI agent      | Reasoning, product behavior, architecture, implementation, tests, verification, and reporting                      |
| Forge skills  | Production failure patterns, procedures, evidence rules, safe-change boundaries, and completion contracts          |
| Forge CLI     | Inventory, discovery, command evidence, deterministic analyzers, state, reports, safe fixes, and Verify/Ship gates |
| Project tools | Tests, linters, databases, browsers, scanners, runtimes, and deployment tooling                                    |

The CLI supports the agent; it is not the main intelligence. A module can be valuable because it
teaches the agent what to inspect, how to reason, what to run, what can fail, how to fix it, and how
to prove the fix—even when no dedicated analyzer exists.

## Optional explicit commands

You can use Forge explicitly, but you usually do not need to. Once installed, supported AI agents
automatically follow Forge while working on your project.

```text
$forge build add patient export
$forge frontend
$forge frontend build
$forge frontend audit
$forge ui review
$forge ux review
$forge accessibility
$forge audit security
$forge audit queries
$forge fix --safe
$forge verify
$forge ship
$forge status
$forge help
```

Terminal and CI equivalents are available through `npx forge`. Explicit commands force or narrow a
workflow; they do not change the evidence standard.

## Automatic activation and ownership

Project installation uses each host's existing skill path and project-instruction mechanism:

| Host                                             | Skills              | Managed project instruction                            |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------ |
| Codex, Antigravity project, generic Agent Skills | `.agents/skills/`   | `AGENTS.md` section                                    |
| Claude Code                                      | `.claude/skills/`   | `CLAUDE.md` section                                    |
| Gemini CLI                                       | `.gemini/skills/`   | `GEMINI.md` section                                    |
| Cursor                                           | `.cursor/skills/`   | `.cursor/rules/fullstack-forge.mdc`                    |
| Windsurf                                         | `.windsurf/skills/` | `.windsurf/rules/fullstack-forge.md`                   |
| GitHub Copilot                                   | `.github/skills/`   | `.github/instructions/fullstack-forge.instructions.md` |

The installer records `agent_first` and `automatic_activation` in
`.fullstack-forge/install-manifest.json`. It refuses symlinked destinations and unowned conflicts,
updates only unchanged Forge-owned files or sections, preserves user-authored content, and removes
only content it owns.

See [platform support](docs/PLATFORM_SUPPORT.md) and [getting started](docs/GETTING_STARTED.md).

## Evidence and reports

Forge writes `.forge/report.json` and `.forge/report.md`. Reports can combine these producer types:

```text
forge-analyzer
forge-command
agent-reviewed-source
agent-rendered-review
agent-runtime-verification
external-tool
human-decision
```

Agent findings include stable identity, module, severity, confidence, status, evidence type, source
lines, explanation, impact, recommendation, safe-fix classification, verification, revision,
commands, and remaining limitations. Use `forge tool ingest-agent-findings <path>` to validate and
merge them into the official report. Markdown, JSON, and the final agent response must not
contradict one another.

Rendered findings use `agent-rendered-review` only when an actual screenshot, viewport,
accessibility-tree, or browser-console observation is attached. Source-only review keeps rendered
behavior `NOT_VERIFIED`.

## Build, Verify, and Ship

Build state under `.forge/build/` records framing, selection, plans, applicability, evidence, and
risk decisions. It never substitutes for Audit or Ship evidence. `forge verify` rechecks finding
specific evidence. `forge ship` is fail-closed and requires current, revision-bound results from
registered producers.

See [Build mode](docs/BUILD_MODE.md), [report schema](docs/REPORT_SCHEMA.md), and the
[CLI reference](docs/CLI_REFERENCE.md).

## Development and release

Canonical skill sources live in `src/fullstack-forge/`. Generated copies under platform folders must
not be edited by hand.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run generate
npm run check
```

Packaging, clean-install, upgrade, offline-install, and Ship commands are documented in
[RELEASE.md](docs/RELEASE.md).

## Version policy

`v0.1.0` is the first intentionally supported public release of the agent-first Fullstack Forge
product. Earlier numbered snapshots were rapid development previews; their existence remains in Git
history and the changelog, but they are not supported releases.

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
