# Fullstack Forge v0.2.0 — Upstream-powered production engineering

Fullstack Forge is now a production-engineering orchestration and verification system that packages
selected open-source specialist expertise behind one consistent workflow. It understands the
repository, selects established specialist expertise, coordinates the relevant engineering
disciplines, resolves conflicts, implements safely, verifies evidence, and decides whether the
result is production-ready.

You still install and use **one product**. There is nothing else to install, invoke, update, or
understand.

## Install

```bash
npm install --save-dev "https://codeload.github.com/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v0.2.0"
npx forge init
npx forge doctor
```

Then ask for the software change directly, exactly as before.

## What changed

Forge previously carried its own copy of every specialist practice. It now composes vendored, pinned
expertise from eight established open-source projects underneath its own contracts.

- **Upstream-powered modules** take an established workflow as their primary procedure: requirements
  interviewing and specification, API design, incremental implementation and code review, testing,
  documentation, debugging and recovery, performance, and the whole UI and UX surface.
- **Hybrid modules** keep Forge's contract and analyzers in charge while adding specialist depth:
  frontend, database, queries, cache, storage, security, observability, reliability, deployment,
  infrastructure, supply chain, scale, cost, accessibility, analytics, AI, auth, payments, realtime,
  and architecture.
- **Forge-native modules** are unchanged in authority: discovery, authorization, tenancy, uploads,
  i18n, SEO, integrations, jobs, notifications, offline, privacy, `forge-all`, and Ship.

All 42 public modules remain available, with the same names and the same activation behaviour. Each
module now carries an engine badge saying whether its expertise is Forge-native, upstream-powered,
or hybrid.

## Forge UI

The UI and UX modules are now powered by Impeccable, exposed entirely as Forge commands:

```
$forge ui init | craft | document | extract | shape | critique | audit | polish | bolder |
quieter | distill | harden | onboard | animate | colorize | typeset | layout | delight |
overdrive | clarify | adapt | optimize | live
```

The previous Forge UI commands (`build`, `review`, `improve`, `fix`, `verify`) still work as
aliases. Project state stays in `PRODUCT.md`, `DESIGN.md`, and `.fullstack-forge/ui/`; critique
snapshots are written to `.fullstack-forge/ui/critique/`. You never type an upstream command and no
separate installation is created.

Historical correction: this candidate included an adapter but did not have a production caller for
the Impeccable detector. v0.2.1 removes those unreachable executables and narrows the integration to
reviewed guidance. Deterministic evidence remains owned by Forge modules, and subjective
visual-craft results remain advisory rather than release blockers.

## Vendored providers

| Provider                          | Licence    | Pinned              |
| --------------------------------- | ---------- | ------------------- |
| Impeccable                        | Apache-2.0 | `skill-v4.0.2`      |
| Addy Osmani Agent Skills          | MIT        | `0.6.5`             |
| Vercel Agent Skills               | MIT        | default-branch head |
| Supabase Agent Skills             | MIT        | `v0.1.6`            |
| Google Skills                     | Apache-2.0 | default-branch head |
| Cloudflare Skills                 | Apache-2.0 | default-branch head |
| Sentry Agent Skills               | Apache-2.0 | default-branch head |
| wshobson Agents (approved subset) | MIT        | default-branch head |

Exact commits, checksums, selected paths, and attribution are in `THIRD_PARTY_NOTICES.md` and
`.fullstack-forge/manifests/upstream-registry.json`. The upstream maintainers do not endorse
Fullstack Forge.

## Guarantees

- **One product.** No upstream skill is installable, discoverable, or triggerable on its own.
  Upstream content ships outside every agent-host skill-discovery root and every upstream `SKILL.md`
  is compiled to `PLAYBOOK.md` with its activation frontmatter made inert.
- **Provider guidance is evidence-gated.** Vercel, Supabase, Google Cloud, Cloudflare, Sentry,
  Stripe, and PayPal material loads only when the repository proves that provider is in use or you
  ask for it by name. A generic queue does not summon Cloudflare; plain PostgreSQL does not summon
  Supabase.
- **Forge stays authoritative.** Applicability, evidence, `PASS`/`FAIL`/`NOT_VERIFIED`/`BLOCKED`/
  `NOT_APPLICABLE`, safe-fix policy, approval boundaries, deterministic analyzers, and the
  fail-closed Ship gate are unchanged. No upstream instruction can fabricate a `PASS`, suppress a
  confirmed finding, or authorise a deployment.
- **Offline by default.** Normal use makes no network request. There is no automatic upstream update
  check and no telemetry.
- **Pinned and checksummed.** Every import is an immutable commit with a content checksum, verified
  by `npm run upstream:verify` on every `npm run check`.

## Upgrading from v0.1.0

Run `npm install` for the new version, then `npx forge init` to refresh the installation and
`npx forge doctor` to confirm it. Nothing you previously typed changes. See
`docs/MIGRATION_v0.2.0.md` for the details, including the one behavioural change to be aware of.

## Known limitations

- `$forge ui live` ships workflow guidance only. The upstream interactive live-editing server, its
  browser bundle, and its hook system are deliberately not vendored.
- `sentry-setup-metrics` does not exist upstream at the pinned commit; Sentry metrics guidance ships
  with the per-SDK references instead.
- The installed package is larger than v0.1.0 because vendored expertise ships with it, so normal
  use stays offline.
- Analyzer precision remains unbenchmarked against an independent external corpus.
