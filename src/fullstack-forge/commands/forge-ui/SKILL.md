---
name: forge-ui
description: Use automatically for visual-interface creation and improvement, including direction, typography, color, spacing, layout, systems, states, consistency, motion, and polish while preserving usability, accessibility, and established brand conventions. Activate automatically for web, mobile, or desktop interface creation and review when that concern is relevant to a software-engineering request.
---

# forge-ui: User interface

Engine: Upstream-powered — Impeccable

## Purpose

Use automatically for visual-interface creation and improvement, including direction, typography, color, spacing, layout, systems, states, consistency, motion, and polish while preserving usability, accessibility, and established brand conventions.


## Deterministic runtime composition

Before loading any provider procedure, run:

`node .fullstack-forge/runtime/cli/src/composition-entry.js ui compose --root <repository-root> --json`

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

Activate when a request or direct repository evidence involves user interface, when
the user explicitly names `forge-ui`, or when discovery proves an applicable boundary.

- Web, mobile, or desktop interface creation and review
- Visual styling, redesigns, component libraries, design systems, themes, dashboards, and landing pages

## When not to activate

- Headless services with no operator or user interface

## Automated support

Relevant discovery inputs are:

- frontend applications
- routes
- design tokens
- running-app URL when available

Deterministic support, bounded evidence only:

- `inspect-rendered-ui`
## Forge UI workflow commands

These are Fullstack Forge commands. There is nothing else to install and no upstream product to
invoke: each route loads the compiled playbook the composition engine selected for it, under
Forge's contracts.

| Command | Purpose |
| --- | --- |
| `$forge ui init` | Establish product and design direction for a surface, writing PRODUCT.md and DESIGN.md. |
| `$forge ui craft` | Build a new interface or replace a visual world at the craft floor. |
| `$forge ui document` | Document the existing design system, tokens, and component inventory. |
| `$forge ui extract` | Extract design tokens and visual truth from the existing implementation. |
| `$forge ui shape` | Shape information architecture, flow, and hierarchy before visual work. |
| `$forge ui critique` | Critique an interface against craft, hierarchy, and usability criteria. |
| `$forge ui audit` | Apply the translated technical audit procedure to available Forge evidence. |
| `$forge ui polish` | Apply bounded, reversible refinement to an existing interface. |
| `$forge ui bolder` | Increase visual confidence and contrast where a design reads timid. |
| `$forge ui quieter` | Reduce visual noise where a design reads loud. |
| `$forge ui distill` | Remove redundancy and reduce an interface to its essential elements. |
| `$forge ui harden` | Cover loading, empty, error, permission, and edge-case states. |
| `$forge ui onboard` | Design first-run, empty-state, and onboarding experience. |
| `$forge ui animate` | Add motion and micro-interactions, subject to reduced-motion requirements. |
| `$forge ui colorize` | Establish or revise the colour system, subject to contrast requirements. |
| `$forge ui typeset` | Establish or revise typography, scale, and rhythm. |
| `$forge ui layout` | Revise spatial composition, grid, alignment, and density. |
| `$forge ui delight` | Add considered moments of delight without harming usability. |
| `$forge ui overdrive` | Push an ambitious visual effect to a technically extraordinary result. |
| `$forge ui clarify` | Improve interface copy, labels, and comprehension. |
| `$forge ui adapt` | Adapt an interface across breakpoints, platforms, and locales. |
| `$forge ui optimize` | Improve measured frontend performance of an interface. |

Compatibility aliases are preserved: `$forge ui build` → `$forge ui craft`, `$forge ui review` → `$forge ui audit`, `$forge ui improve` → `$forge ui polish`, `$forge ui fix` → `$forge ui polish`, `$forge ui verify` → `$forge ui audit`.

Forge-managed project state lives in `PRODUCT.md`, `DESIGN.md`, and `.fullstack-forge/ui/`;
critique snapshots are written to `.fullstack-forge/ui/critique/`. No separately managed upstream
installation is created or required.

Subjective visual-craft results are advisories: they are reported for judgement and never block
Verify or Ship. Accessibility, layout, and measured-performance defects with concrete evidence are
findings owned by `forge-accessibility`, `forge-frontend`, and `forge-performance`.

## Experience workflow and progressive references

Automatic activation signals include:

- Strong visual intent such as UI, visual design, redesign, styling, spacing, typography, color, design systems, landing pages, or visual polish
- Ambiguous component, layout, state, table, dashboard, chart, or interface terms only with supporting human-facing or repository evidence

Explicit agent shortcuts are `$forge ui build`, `$forge ui review`, `$forge ui audit`, `$forge ui fix`. `review` routes to evidence-preserving `audit`;
`improve` routes to a fix preview unless safe application is explicitly authorized. Normal feature
requests do not require a command.

Use this proportional workflow: `UNDERSTAND` → `INSPECT` → `SELECT` → `DEFINE` → `IMPLEMENT` → `RENDER` → `VALIDATE` → `REFINE` → `REPORT`.
For a small bounded change, keep the same order but record decisions inline; optional templates must
not become ceremony.

Load only the references selected by the request and repository evidence:

- `visual-direction` — load the installed bundle file `fullstack-forge/references/frontend/visual-direction.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `design-system` — load the installed bundle file `fullstack-forge/references/frontend/design-system.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `responsive-layout` — load the installed bundle file `fullstack-forge/references/frontend/responsive-layout.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `motion-and-interactions` — load the installed bundle file `fullstack-forge/references/frontend/motion-and-interactions.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `dashboards-and-data-visualization` — load the installed bundle file `fullstack-forge/references/frontend/dashboards-and-data-visualization.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `design-review` — load the installed bundle file `fullstack-forge/references/frontend/design-review.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `anti-patterns` — load the installed bundle file `fullstack-forge/references/frontend/anti-patterns.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.

Accessibility rules remain owned by `forge-accessibility`; localization by `forge-i18n`;
performance proof by `forge-performance`; public-search behavior by `forge-seo`. Compose those
owners instead of copying their rules here. Never load mobile, chart, motion, or framework guidance
without matching evidence.


## Agent inspection procedure

1. Inspect the product goal, existing brand assets, design tokens, component library, styling mechanism, and nearest visual precedent before proposing a direction.
2. For substantial work, state the intended character, typography, color, density, layout, shape, imagery, icon, and motion choices with a product-specific rationale.
3. Start or attach to the running application and enumerate representative routes and states from router or navigation evidence.
4. Inspect each representative screen at failure-driven small, medium, and wide viewports, recording URL, viewport, theme, locale, input method, and observed layout.
5. Force loading, partial, empty, error, success, permission, disabled, focus, hover or press, destructive, and long-content states that can occur.
6. Compare repeated components for semantic-token, state, spacing, typography, icon, and responsive drift; preserve established conventions unless direct evidence shows harm.
7. Capture browser console and accessibility output on inspected routes; when rendering is unavailable, mark visual behavior `NOT_VERIFIED` rather than inferring it from source.

Manual inspection requirements:

- Compare critical screens across themes and input methods
- Judge visual hierarchy and brand consistency from captured evidence

Stack-specific guidance:

- Use native framework semantics and preserve server/client rendering boundaries

## Evidence to collect

Standards used as criteria:

- WCAG 2.2
- WAI-ARIA Authoring Practices Guide
- Core Web Vitals

## Common production failures

- Inspect the running application at representative small, medium, and wide viewports where possible
- Verify loading, empty, error, success, disabled, focus, hover, and long-content states
- Check semantic tokens, typography hierarchy, spacing rhythm, image dimensions, overflow, and reduced motion

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Visual hierarchy
- Typography
- Spacing, alignment, and layout rhythm
- Design tokens and color system
- Component consistency
- Forms, tables, and modals
- Navigation
- Mobile responsiveness
- Tablet responsiveness
- Desktop layout
- Dark mode
- Loading states and skeletons
- Empty states
- Error states
- Success states
- Disabled states
- Focus states
- Hover states
- Destructive states
- Visual regressions
- Browser-console errors
- Generic AI-generated appearance
- Unfinished screens
- Inconsistent icons
- Image treatment
- Charts and data visualization
- Representative running routes
- Desktop, tablet, and mobile screenshots
- Repeated-component comparison
- Recorded visual evidence and cleanup of started processes
- Product-specific visual direction with rationale
- Preservation of existing brand and component conventions
- Light and dark theme state parity
- Truthful content and non-fabricated credibility signals

## Commands and tools

- Run `forge ui audit --json` or `fullstack-forge ui audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Add missing accessible labels or non-breaking responsive constraints
- Correct token use and layout-shift-causing dimensions

## Approval-required changes

- Changing the product's visual language or interaction model

## Verification

- Reinspect changed screens at 320, 375, 768, 1024, and 1440 CSS pixels
- Confirm keyboard focus and no unintended horizontal overflow

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Do not claim browser or device inspection unless it actually ran
