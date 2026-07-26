---
name: forge-accessibility
description: Use automatically for human-facing interface work and audit WCAG 2.2 AA with automated evidence plus keyboard and assistive-technology reasoning. Activate automatically for any user or operator interface when that concern is relevant to a software-engineering request.
---

# forge-accessibility: Accessibility

## Purpose

Use automatically for human-facing interface work and audit WCAG 2.2 AA with automated evidence plus keyboard and assistive-technology reasoning.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves accessibility, when
the user explicitly names `forge-accessibility`, or when discovery proves an applicable boundary.

- Any user or operator interface
- Generated documents with interactive navigation

## When not to activate

- A protocol-only library with no human-facing output

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- rendered routes
- component source
- automated accessibility command

Available deterministic support, where present:

- Use `inspect-rendered-ui` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Traverse each representative screen with keyboard only: record tab order, focus visibility, traps, and any control unreachable without a pointer.
3. Compute accessible names and roles for interactive elements from markup or the accessibility tree, not from visual labels.
4. Check contrast for text and interactive states against WCAG 2.2 AA thresholds using measured colors.
5. Exercise dynamic behavior: dialogs, expanders, validation errors, and live updates, and record what assistive technology is told at each change.
6. Test zoom to 200% and reflow at 320px width, recording clipped or unusable content.
7. Run an automated scanner when available, then state plainly which criteria it cannot judge and mark those manual.
8. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
9. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review accessible names in context and screen-reader reading order
- Test high-risk custom widgets against the APG pattern

Stack-specific guidance:

- Prefer native HTML or platform controls before ARIA-based reimplementation

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

- WCAG 2.2 Level AA
- WAI-ARIA 1.2
- WAI-ARIA Authoring Practices Guide

## Common production failures

- Check names, roles, states, landmarks, headings, labels, alternatives, contrast, zoom, reflow, target size, and status messages
- Complete all critical workflows using keyboard only
- Inspect focus order, focus trapping, restoration, errors, dynamic updates, and reduced motion

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use `inspect-rendered-ui` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Associate labels, restore visible focus, and add missing semantic state
- Add text alternatives supported by surrounding context

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Replacing a custom interaction or materially changing content meaning

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Re-run automated checks and keyboard walkthroughs
- Map findings to exact WCAG success criteria

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

- Automated scanners cover only part of WCAG; unperformed assistive-technology tests are NOT_VERIFIED

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
