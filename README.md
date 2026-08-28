# Turn your AI coding agent into a production-focused full-stack engineer

Fullstack Forge is a production-engineering orchestration and verification system that packages
selected open-source specialist expertise behind one consistent workflow. It understands the
repository, selects established specialist expertise, coordinates architecture, security, databases,
APIs, frontend, UI, UX, testing, performance, reliability, and release readiness, resolves conflicts
between them, implements safely, verifies evidence, and decides whether the result is
production-ready.

Once installed, it works automatically. Continue talking to your AI agent normally. Forge is
agent-guided, with deterministic CLI checks and evidence gates where supported.

**You install and use one product.** Forge vendors expertise from eight open-source Agent Skills
projects, but you never install, invoke, update, or need to understand any of them.

[![Release](https://img.shields.io/github/v/release/is-bo/fullstack-forge-skill)](https://github.com/is-bo/fullstack-forge-skill/releases)
[![CI](https://github.com/is-bo/fullstack-forge-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/is-bo/fullstack-forge-skill/actions/workflows/ci.yml)

![Fullstack Forge overview](docs/assets/fullstack-forge-hero.png)

## Install

Requires Node.js 20.19+, 22.13+, or 24+.

Use the newest immutable release shown on the
[GitHub Releases page](https://github.com/is-bo/fullstack-forge-skill/releases). The direct package
link for the `v0.3.1` candidate release is:

<https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.1/fullstack-forge-skill-v0.3.1.tgz>

```bash
npm install --save-dev "https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.1/fullstack-forge-skill-v0.3.1.tgz"
# NOT YET AVAILABLE until the v0.3.1 GitHub Release is published.
npx --no-install forge init
npx --no-install forge doctor
```

If your AI agent is doing the setup, send it this one message and the agent can perform the
download, install, and health check from the exact release URL:

```bash
Install Fullstack Forge in this project from this exact verified release:
https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.1/fullstack-forge-skill-v0.3.1.tgz
# NOT YET AVAILABLE until the v0.3.1 GitHub Release is published.
Use only that URL (do not use a different npm package or an unpinned npx command), install it as a
development dependency, run `npx --no-install forge init`, then run `npx --no-install forge doctor`.
Report the installed version and any verification failure.
```

For an existing installation, update from the same immutable package:

```bash
npm install --save-dev "https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.1/fullstack-forge-skill-v0.3.1.tgz"
# NOT YET AVAILABLE until the v0.3.1 GitHub Release is published.
npx --no-install forge update all
npx --no-install forge doctor
```

Do not install the unpublished historical v0.2.0 or v0.2.1 tags.

Restart or reopen your AI coding agent only if it does not refresh installed project skills
automatically. `forge init` installs skills and ownership-managed project instructions for detected
hosts; use `forge init all` only when you intentionally want every bundled platform.

### Codex plugin distribution

The repository also carries a Codex plugin manifest and repo marketplace. The marketplace is
fail-closed as `NOT_AVAILABLE` while its pinned `fullstack-forge-skill` npm package is unpublished.
The plugin's `skills/` root contains generated thin adapters; the generic `.agents/skills/` host
root remains available in the same package, and both point at the one canonical
`.fullstack-forge/skills/` playbook tree. Full playbooks are never duplicated into the plugin
adapter root. After the matching version is published to npm, its registry artifact is verified, and
the marketplace policy is changed to `AVAILABLE`, register and install it with the current Codex CLI
commands:

```bash
codex plugin marketplace add https://github.com/is-bo/fullstack-forge-skill
codex plugin add fullstack-forge@fullstack-forge
```

A plugin-only install does not add a `forge` executable to the target repository. Use the installed
agent skills and their package-cache composition runner. If you also want the terminal CLI, install
the exact Fullstack Forge release package in the project and use `npx --no-install forge ...`; never
run bare `npx forge` from a plugin-only project because the public npm package named `forge` is a
different product.

After a verified catalog version change, refresh and reinstall explicitly:

```bash
codex plugin marketplace upgrade fullstack-forge
codex plugin remove fullstack-forge@fullstack-forge
codex plugin add fullstack-forge@fullstack-forge
```

To uninstall the plugin, run `codex plugin remove fullstack-forge@fullstack-forge`. Remove the
marketplace separately with `codex plugin marketplace remove fullstack-forge` only when you no
longer want that catalog configured.

The checked-in v0.3.1 marketplace entry is intentionally version-pinned and disabled because the npm
package is not published. A GitHub Release does not publish it to npm. Verify
`npm view fullstack-forge-skill@0.3.1 version` before attempting plugin installation; until that
separate publication and the `AVAILABLE` policy are both observed, use the project installation
above.

## How to use it

Tell your AI agent what you want:

> Add appointment cancellation and notify the patient.

> Review the database queries and optimise anything that is actually inefficient.

> Improve the mobile booking experience.

> Prepare this application for release.

Forge activates automatically and loads only the relevant modules. No Forge command is required.

## Optional commands

Use an explicit Forge command when you want to force or narrow a workflow:

```text
/forge audit security
/forge audit queries
/forge audit cache
/forge frontend
/forge ui review
/forge ux review
/forge verify
/forge ship
```

The installed skill name is `forge`; host syntax differs:

```text
Agent Skills form where supported:  $forge audit cache
Slash form where the host exposes skills as commands:  /forge audit cache
Project-package terminal and CI:  npx --no-install forge audit cache
```

The terminal form is the stable executable interface. See
[platform support](docs/PLATFORM_SUPPORT.md) for host-specific selection forms and live-UI
limitations. Explicit commands preserve the same evidence and approval rules as automatic use.

## Where the expertise comes from

Forge owns the operating system: repository discovery, task interpretation, risk detection,
applicability, module selection, progressive disclosure, cross-domain coordination, conflict
resolution, approval boundaries, safe-fix policy, evidence requirements, deterministic analyzers,
the `PASS` / `FAIL` / `NOT_VERIFIED` / `BLOCKED` / `NOT_APPLICABLE` contract, and the fail-closed
Ship gate.

Specialist procedure comes from vendored open-source expertise. Every module says which:

```text
Engine: Forge native
Engine: Upstream-powered — Impeccable
Engine: Hybrid — Forge + Vercel
```

| Provider                          | Licence    | Powers                                                      |
| --------------------------------- | ---------- | ----------------------------------------------------------- |
| Impeccable                        | Apache-2.0 | reviewed UI and UX guidance                                 |
| Addy Osmani Agent Skills          | MIT        | requirements, code, testing, docs, recovery, performance    |
| Vercel Agent Skills               | MIT        | React, Next.js, React Native, and web-design guidance       |
| Supabase Agent Skills             | MIT        | PostgreSQL practice, and Supabase where it is in use        |
| Google Skills                     | Apache-2.0 | Well-Architected pillars, Cloud Run, Cloud SQL, GKE, Gemini |
| Cloudflare Skills                 | Apache-2.0 | Workers, Wrangler, Durable Objects, web performance         |
| Sentry Agent Skills               | MIT        | issue investigation, tracing, and SDK setup                 |
| wshobson Agents (approved subset) | MIT        | accessibility, payments, threat modelling, AI, SQL, SLOs    |

Provider guidance is **evidence-gated**: Vercel, Supabase, Google Cloud, Cloudflare, Sentry, Stripe,
and PayPal material loads only when your repository proves that provider is in use, or when you name
it. A generic queue does not summon Cloudflare advice; plain PostgreSQL does not summon Supabase
advice.

Upstream skills cannot activate on their own. Their content installs outside every agent-host
skill-discovery root, and each upstream `SKILL.md` is compiled to `PLAYBOOK.md` with its activation
frontmatter made inert, so it reaches the agent only when Forge selects it. When Forge and an
upstream workflow disagree, Forge wins — see
`fullstack-forge/references/shared/composition-precedence.md`.

Normal use is fully offline. There is no automatic upstream update check and no telemetry. Every
import is pinned to an immutable commit and checksummed. Inspect exactly what you have in
`.fullstack-forge/manifests/upstream-registry.json` and `THIRD_PARTY_NOTICES.md`.

Attribution, licences, exact commits, and the modifications Forge applies are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The upstream maintainers do not endorse Fullstack
Forge.

## Forge UI

The UI and UX workflows are Forge commands:

```text
$forge ui init | craft | document | extract | shape | critique | audit | polish | bolder |
quieter | distill | harden | onboard | animate | colorize | typeset | layout | delight |
overdrive | clarify | adapt | optimize
```

Earlier Forge UI commands still work as aliases (`build` to `craft`, `review` and `verify` to
`audit`, `improve` and `fix` to `polish`). Project state lives in `PRODUCT.md`, `DESIGN.md`, and
`.fullstack-forge/ui/`.

`forge ui audit` applies reviewed Impeccable guidance to evidence already available to Forge. The
Impeccable detector executable is not shipped or invoked; deterministic checks remain Forge-owned,
and subjective visual-craft results are advisories that never block Ship.

## What Forge does

For a normal feature, Forge helps the agent:

- understand the existing application;
- select relevant engineering modules;
- implement through existing patterns;
- check related production concerns;
- run focused tests and tools;
- report what was verified and what remains uncertain.

Forty-two specialist modules cover foundation, frontend experience, APIs and trust boundaries, data,
delivery, and capabilities such as notifications, AI, payments, realtime, and offline behavior.
Natural-language routing is an initial aid: direct repository evidence determines final
applicability.

## Short example

```text
User:
Add a feature that lets doctors cancel appointments and notify patients.

Agent with Fullstack Forge:
- Inspects the appointment and notification architecture.
- Selects API, database, authorization, notification, UX, and testing guidance.
- Implements status transitions and prevents unauthorized cancellation.
- Handles notification failure and adds focused tests.
- Reports the checks that passed and any proof that remains unavailable.
```

For a one-line visual adjustment, Forge keeps the plan and validation focused. For identity,
permissions, personal data, payments, uploads, destructive operations, secrets, or tenancy, it
requires stronger evidence and surfaces approval boundaries.

## Supported agents

| Host                                             | Installed project skill path | Managed automatic instruction                          |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------------ |
| Codex, generic Agent Skills, Antigravity project | `.agents/skills/`            | `AGENTS.md`                                            |
| Claude Code                                      | `.claude/skills/`            | `CLAUDE.md`                                            |
| Gemini CLI                                       | `.gemini/skills/`            | `GEMINI.md`                                            |
| Cursor                                           | `.cursor/skills/`            | `.cursor/rules/fullstack-forge.mdc`                    |
| Windsurf                                         | `.windsurf/skills/`          | `.windsurf/rules/fullstack-forge.md`                   |
| GitHub Copilot                                   | `.github/skills/`            | `.github/instructions/fullstack-forge.instructions.md` |

Installation is manifest-owned, path-contained, and symlink-free. Updates preserve modified and
user-authored instructions; uninstall removes only unchanged Forge-owned content. See
[getting started](docs/GETTING_STARTED.md) and [platform support](docs/PLATFORM_SUPPORT.md).

OpenCode and Roo Code can consume the generic `.agents/skills/` adapters; Forge does not generate
new `.opencode/` or `.roo/` roots. Cline support is best-effort through the existing
`.claude/skills/` adapters while its Skills feature remains experimental; no `.cline/` tree is
generated or treated as a verified target.

The reviewed ecosystem opportunities and license decisions are tracked in
[research sources](research/SOURCES.md). Stars are discovery signals only and were captured from
public repository metadata on 2026-08-10; they are not quality or security guarantees.

Separately installed expert packs can be supplied explicitly as user-managed advisory context; they
are not bundled or automatically composed by Forge. A host may still activate a separately installed
pack under that pack's own rules, but its advice cannot satisfy or override Forge evidence and
safety contracts. See [external experts](docs/EXTERNAL_EXPERTS.md).

## Evidence and limitations

Forge is not a standalone universal scanner and does not guarantee that an application is
production-ready. It gives the AI agent a structured, evidence-based production-readiness workflow.

A `PASS` requires affirmative evidence. Applicable proof that cannot be obtained stays
`NOT_VERIFIED` or `BLOCKED`; a concern shown to be outside the affected boundary is reasoned
`NOT_APPLICABLE`, never a synthetic pass. Agent-authored findings bind source or runtime evidence,
revision, commands, limitations, and verification. Build state and historical reports never satisfy
the independent Ship gate.

Detailed references:

- [Architecture](docs/ARCHITECTURE.md)
- [Commands](docs/COMMANDS.md) and [CLI reference](docs/CLI_REFERENCE.md)
- [Finding schema](docs/FINDING_SCHEMA.md) and [report schema](docs/REPORT_SCHEMA.md)
- [Build mode](docs/BUILD_MODE.md) and [release workflow](docs/RELEASE.md)

## Development and contributor information

Canonical skill sources live in `src/fullstack-forge/`. Generated platform copies must not be edited
by hand.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run generate
npm run check
```

See [development](docs/DEVELOPMENT.md), [contributing](CONTRIBUTING.md), and
[security](SECURITY.md).

## Version policy

The `v0.3.1` source candidate is not currently downloadable as a GitHub Release. `v0.2.2` remains
the current supported immutable public release for fallback compatibility. `v0.2.0` and `v0.2.1`
remain fetchable historical tags without GitHub Releases; none of those tags will be moved or
rewritten. The npm package remains unpublished.

See [the v0.3.1 migration notes](docs/MIGRATION_v0.3.1.md) when upgrading an existing installation.

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
