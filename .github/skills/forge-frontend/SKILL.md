---
name: forge-frontend
description: Use automatically for frontend implementation and review, including components, pages, layouts, responsive behavior, React, Next.js, browser state, rendering, hydration, network behavior, and measured frontend performance. Activate automatically for browser, react native, and expo application work when that concern is relevant to a software-engineering request.
---

# forge-frontend: Frontend engineering

## Purpose

Use automatically for frontend implementation and review, including components, pages, layouts, responsive behavior, React, Next.js, browser state, rendering, hydration, network behavior, and measured frontend performance.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves frontend engineering, when
the user explicitly names `forge-frontend`, or when discovery proves an applicable boundary.

- Browser, React Native, and Expo application work
- React, Next.js, Vue, Svelte, and hybrid server/client rendered frontends

## When not to activate

- Backend-only services

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- frontend manifests
- route tree
- build configuration
- network client code

Available deterministic support, where present:

- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
## Experience workflow and progressive references

Automatic activation signals include:

- React, Next.js, Vue, Svelte, React Native, or Expo
- components, pages, layouts, forms, tables, charts, browser state, rendering, hydration, bundles, or responsive implementation

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

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inspect the actual framework, version, rendering mode, styling system, routes, shared components, state and data libraries, tests, translations, and existing interface conventions.
3. Route only matching progressive references, then define the user task, system states, responsive behavior, accessibility needs, component reuse, framework boundary, and evidence plan proportionately.
4. Map component and data-fetching boundaries, identify server/client splits, and trace one interactive flow from route load through loading, failure, recovery, and rendered state.
5. Inspect network behavior for waterfalls, duplicate requests, cancellation, stale results, optimistic rollback, and behavior on slow or unreliable networks.
6. Inspect component APIs and state management for boolean-prop conflicts, duplicated derived state, unnecessary effects, rerender causes, error boundaries, and cleanup ownership.
7. Use a production build and measured evidence for bundle, hydration, rendering, media, font, or list-performance claims; do not infer speed from source shape.
8. Render and compare the affected routes when tools are available, run focused project checks, refine confirmed defects, and report every unverified browser, device, user, or production claim.
9. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
10. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Exercise slow, offline, duplicate, and out-of-order responses
- Inspect bundle composition and runtime console output when tooling is available

Stack-specific guidance:

- Follow the detected framework's current server/client and cache semantics

## Evidence to collect

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

Primary standards used as criteria, not proof of compliance:

- WHATWG HTML
- Core Web Vitals
- OWASP XSS Prevention Cheat Sheet

## Common production failures

- Trace data fetching, caching, cancellation, race handling, optimistic rollback, and stale-state behavior
- Inspect rendering boundaries, hydration, error boundaries, code splitting, source maps, and browser compatibility
- Check untrusted HTML, client secrets, CSRF assumptions, and sensitive storage

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add abort handling, explicit states, and deterministic lazy boundaries
- Remove confirmed client-side secret exposure

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Replacing state architecture or changing rendering strategy

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run production build and representative browser flows
- Confirm server/client output and network failure recovery

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Bundle and performance claims require measured artifacts

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
