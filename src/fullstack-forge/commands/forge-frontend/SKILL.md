---
name: forge-frontend
description: Use automatically for frontend implementation and review, including components, pages, layouts, responsive behavior, React, Next.js, browser state, rendering, hydration, network behavior, and measured frontend performance. Activate automatically for browser, react native, and expo application work when that concern is relevant to a software-engineering request.
---

# forge-frontend: Frontend engineering

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Vercel

## Purpose

Use automatically for frontend implementation and review, including components, pages, layouts, responsive behavior, React, Next.js, browser state, rendering, hydration, network behavior, and measured frontend performance.


## Deterministic runtime composition

Before loading any provider procedure, run:

`node .fullstack-forge/runtime/cli/src/composition-entry.js frontend compose --root <repository-root> --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. Read `.forge/composition.json`, keep the Forge
contract at index zero, and load only the ordered `selected` runtime paths. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback.


Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves frontend engineering, when
the user explicitly names `forge-frontend`, or when discovery proves an applicable boundary.

- Browser, React Native, and Expo application work
- React, Next.js, Vue, Svelte, and hybrid server/client rendered frontends

## When not to activate

- Backend-only services

## Automated support

Relevant discovery inputs are:

- frontend manifests
- route tree
- build configuration
- network client code

Deterministic support, bounded evidence only:

- None; use detected project commands and direct manual evidence.
## Experience workflow and progressive references

Automatic activation signals include:

- Strong request signals such as React, Next.js, Vue, Svelte, JSX, TSX, browser, CSS, responsive layout, hydration, client component, landing page, mobile interface, React Native, or Expo
- Ambiguous page, table, form, component, layout, state, dashboard, or chart terms only when affected paths, application type, workspace, framework, project profile, changed files, or another strong signal supports frontend work

Explicit agent shortcuts are `$forge frontend build`, `$forge frontend audit`, `$forge frontend fix`, `$forge frontend verify`. `review` routes to evidence-preserving `audit`;
`improve` routes to a fix preview unless safe application is explicitly authorized. Normal feature
requests do not require a command.

Use this proportional workflow: `UNDERSTAND` → `INSPECT` → `SELECT` → `DEFINE` → `IMPLEMENT` → `RENDER` → `VALIDATE` → `REFINE` → `REPORT`.
For a small bounded change, keep the same order but record decisions inline; optional templates must
not become ceremony.

Load only the references selected by the request and repository evidence:

- `product-and-ux` — load the installed bundle file `fullstack-forge/references/frontend/product-and-ux.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `visual-direction` — load the installed bundle file `fullstack-forge/references/frontend/visual-direction.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `design-system` — load the installed bundle file `fullstack-forge/references/frontend/design-system.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `responsive-layout` — load the installed bundle file `fullstack-forge/references/frontend/responsive-layout.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `accessibility-integration` — load the installed bundle file `fullstack-forge/references/frontend/accessibility-integration.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `component-architecture` — load the installed bundle file `fullstack-forge/references/frontend/component-architecture.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `react-nextjs` — load the installed bundle file `fullstack-forge/references/frontend/react-nextjs.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `frontend-performance` — load the installed bundle file `fullstack-forge/references/frontend/frontend-performance.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `motion-and-interactions` — load the installed bundle file `fullstack-forge/references/frontend/motion-and-interactions.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `forms-and-data-entry` — load the installed bundle file `fullstack-forge/references/frontend/forms-and-data-entry.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `dashboards-and-data-visualization` — load the installed bundle file `fullstack-forge/references/frontend/dashboards-and-data-visualization.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `mobile-react-native` — load the installed bundle file `fullstack-forge/references/frontend/mobile-react-native.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `design-review` — load the installed bundle file `fullstack-forge/references/frontend/design-review.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `anti-patterns` — load the installed bundle file `fullstack-forge/references/frontend/anti-patterns.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.

Accessibility rules remain owned by `forge-accessibility`; localization by `forge-i18n`;
performance proof by `forge-performance`; public-search behavior by `forge-seo`. Compose those
owners instead of copying their rules here. Never load mobile, chart, motion, or framework guidance
without matching evidence.


## Agent inspection procedure

1. Inspect the actual framework, version, rendering mode, styling system, routes, shared components, state and data libraries, tests, translations, and existing interface conventions.
2. Route only matching progressive references, then define the user task, system states, responsive behavior, accessibility needs, component reuse, framework boundary, and evidence plan proportionately.
3. Map component and data-fetching boundaries, identify server/client splits, and trace one interactive flow from route load through loading, failure, recovery, and rendered state.
4. Inspect network behavior for waterfalls, duplicate requests, cancellation, stale results, optimistic rollback, and behavior on slow or unreliable networks.
5. Inspect component APIs and state management for boolean-prop conflicts, duplicated derived state, unnecessary effects, rerender causes, error boundaries, and cleanup ownership.
6. Use a production build and measured evidence for bundle, hydration, rendering, media, font, or list-performance claims; do not infer speed from source shape.
7. Render and compare the affected routes when tools are available, run focused project checks, refine confirmed defects, and report every unverified browser, device, user, or production claim.

Manual inspection requirements:

- Exercise slow, offline, duplicate, and out-of-order responses
- Inspect bundle composition and runtime console output when tooling is available

Stack-specific guidance:

- Follow the detected framework's current server/client and cache semantics

## Evidence to collect

Standards used as criteria:

- WHATWG HTML
- Core Web Vitals
- OWASP XSS Prevention Cheat Sheet

## Common production failures

- Trace data fetching, caching, cancellation, race handling, optimistic rollback, and stale-state behavior
- Inspect rendering boundaries, hydration, error boundaries, code splitting, source maps, and browser compatibility
- Check untrusted HTML, client secrets, CSRF assumptions, and sensitive storage

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Component boundaries
- Client/server boundaries
- State management
- Data-fetching waterfalls
- Duplicate requests
- Unnecessary renders
- Bundle size
- Code splitting
- Lazy loading
- Hydration issues
- Race conditions
- Optimistic updates
- Error boundaries
- Stale state
- Browser compatibility
- Memory leaks
- Listener cleanup
- Form state
- URL state
- Offline behavior
- Image loading
- Font loading
- Dependency weight
- Progressive reference selection
- Detected framework and version
- Existing component and styling precedent
- Rendered review or explicit visual NOT_VERIFIED status
- Production-build behavior

## Commands and tools

- Run `forge frontend audit --json` or `fullstack-forge frontend audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Add abort handling, explicit states, and deterministic lazy boundaries
- Remove confirmed client-side secret exposure

## Approval-required changes

- Replacing state architecture or changing rendering strategy

## Verification

- Run production build and representative browser flows
- Confirm server/client output and network failure recovery

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Bundle and performance claims require measured artifacts
