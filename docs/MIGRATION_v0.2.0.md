# Migrating to Fullstack Forge v0.2.0

v0.2.0 changes how Forge gets its expertise, not how you use it. Forge is still one installable
product, all 42 modules keep their names and automatic activation, and every command you already
type still works.

## Upgrade

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.2.0"
npx forge init
npx forge doctor
```

`forge init` refreshes the managed installation in place. It never overwrites a file you have
modified: a changed file is reported, not clobbered. `forge doctor` confirms the result.

## What is new on disk

Your project gains two managed directories, both outside every agent-host skill-discovery root:

```
.fullstack-forge/
├── skills/        (unchanged: the canonical Forge playbooks)
├── upstream/      (new: compiled specialist expertise, not host-discoverable)
└── manifests/     (new: the upstream registry, module composition, and transform record)
```

Nothing in `upstream/` is a skill your agent host can find or trigger. Every upstream `SKILL.md` is
compiled to `PLAYBOOK.md` with its activation frontmatter made inert, so upstream expertise reaches
the agent only when Forge's composition engine selects it.

Uninstalling the last host removes all of it.

## The one behavioural change to be aware of

Provider guidance is now evidence-gated. Forge loads Vercel, Supabase, Google Cloud, Cloudflare,
Sentry, Stripe, or PayPal material **only** when your repository proves that provider is in use, or
when you ask for it by name. This is deliberate: a generic queue no longer attracts Cloudflare
advice, and plain PostgreSQL no longer attracts Supabase advice.

If you want provider guidance the repository cannot prove — for example when planning a migration
onto a platform you do not use yet — name the provider in your request.

## Forge UI

The UI and UX modules are now powered by Impeccable, entirely behind Forge commands:

```
$forge ui init | craft | document | extract | shape | critique | audit | polish | bolder |
quieter | distill | harden | onboard | animate | colorize | typeset | layout | delight |
overdrive | clarify | adapt | optimize | live
```

Your existing Forge UI commands still work: `build` maps to `craft`, `review` and `verify` to
`audit`, and `improve` and `fix` to `polish`.

If you previously used Impeccable separately, note that Forge does not create, read, or depend on a
`.impeccable/` directory. Forge-managed UI state lives in `PRODUCT.md`, `DESIGN.md`, and
`.fullstack-forge/ui/`, with critique snapshots under `.fullstack-forge/ui/critique/`. You do not
need Impeccable installed, and you never type `/impeccable`.

Design-detector results now reach you as Forge findings. Accessibility, layout, and measured
performance defects with concrete file evidence are findings owned by `forge-accessibility`,
`forge-frontend`, and `forge-performance`. Subjective visual-craft results are advisories: they are
reported for judgement and **cannot block Ship**.

## What did not change

- Module names, automatic activation, and the proportional workflow.
- Applicability, evidence rules, and the `PASS` / `FAIL` / `NOT_VERIFIED` / `BLOCKED` /
  `NOT_APPLICABLE` status contract.
- Safe-fix policy, approval boundaries, and the fail-closed Ship gate.
- Every deterministic analyzer, including upload, authorization, tenancy, transaction, SQL, and
  cache analysis.
- Canonical, symlink-free installation and offline operation.

No upstream instruction can fabricate a `PASS`, suppress a confirmed Forge finding, relax an
approval boundary, or trigger a deployment. See
`fullstack-forge/references/shared/composition-precedence.md` for the full rule.

## Inspecting what you have

```bash
npm run upstream:status
```

Reports every vendored provider, its licence, its pinned tag and immutable commit, its content
checksum, its selected paths, and which Forge modules use it. `npm run upstream:verify` re-checks
the pins and checksums offline.

Nothing updates automatically. Forge performs no upstream update check and ships no telemetry.

## If something looks wrong

Run `npx forge doctor`. If a module reports that declared upstream content is missing, the
installation is damaged rather than merely incomplete — Forge reports `NOT_VERIFIED` instead of a
clean result. Run `npx forge update all` to repair it.
