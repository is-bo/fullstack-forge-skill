---
name: forge-accessibility
description: Use automatically for human-facing interface work and audit WCAG 2.2 AA with automated evidence plus keyboard and assistive-technology reasoning. Activate automatically for any user or operator interface when that concern is relevant to a software-engineering request.
---

# forge-accessibility: Accessibility

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Vercel

## Purpose

Use automatically for human-facing interface work and audit WCAG 2.2 AA with automated evidence plus keyboard and assistive-technology reasoning.


## Deterministic runtime composition

Before loading any provider procedure, run:

`node .fullstack-forge/runtime/cli/src/composition-entry.js accessibility compose --root <repository-root> --json`

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

Activate when a request or direct repository evidence involves accessibility, when
the user explicitly names `forge-accessibility`, or when discovery proves an applicable boundary.

- Any user or operator interface
- Generated documents with interactive navigation

## When not to activate

- A protocol-only library with no human-facing output

## Automated support

Relevant discovery inputs are:

- rendered routes
- component source
- automated accessibility command

Deterministic support, bounded evidence only:

- `inspect-rendered-ui`

## Agent inspection procedure

1. Traverse each representative screen with keyboard only: record tab order, focus visibility, traps, and any control unreachable without a pointer.
2. Compute accessible names and roles for interactive elements from markup or the accessibility tree, not from visual labels.
3. Check contrast for text and interactive states against WCAG 2.2 AA thresholds using measured colors.
4. Exercise dynamic behavior: dialogs, expanders, validation errors, and live updates, and record what assistive technology is told at each change.
5. Test zoom to 200% and reflow at 320px width, recording clipped or unusable content.
6. Run an automated scanner when available, then state plainly which criteria it cannot judge and mark those manual.

Manual inspection requirements:

- Review accessible names in context and screen-reader reading order
- Test high-risk custom widgets against the APG pattern

Stack-specific guidance:

- Prefer native HTML or platform controls before ARIA-based reimplementation

## Evidence to collect

Standards used as criteria:

- WCAG 2.2 Level AA
- WAI-ARIA 1.2
- WAI-ARIA Authoring Practices Guide

## Common production failures

- Check names, roles, states, landmarks, headings, labels, alternatives, contrast, zoom, reflow, target size, and status messages
- Complete all critical workflows using keyboard only
- Inspect focus order, focus trapping, restoration, errors, dynamic updates, and reduced motion

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- WCAG 2.2 AA scope
- Keyboard navigation
- Focus order
- Focus visibility
- Focus trapping
- Semantic HTML
- Accessible names
- Form labels
- Error announcements
- Status announcements
- Contrast
- Touch targets
- Heading structure
- Landmarks
- Alt text
- Link purpose
- Table semantics
- Reduced motion
- Zoom
- Text resizing
- Responsive reflow
- Dialog behavior
- Skip links
- Screen-reader navigation
- Captions where applicable
- Auto-playing media
- Time limits
- Automated evidence plus manual keyboard and assistive-technology checks

## Commands and tools

- Run `forge accessibility audit --json` or `fullstack-forge accessibility audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Associate labels, restore visible focus, and add missing semantic state
- Add text alternatives supported by surrounding context

## Approval-required changes

- Replacing a custom interaction or materially changing content meaning

## Verification

- Re-run automated checks and keyboard walkthroughs
- Map findings to exact WCAG success criteria

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Automated scanners cover only part of WCAG; unperformed assistive-technology tests are NOT_VERIFIED
