---
name: forge-accessibility
description: Audit conformance with WCAG 2.2 AA using automated evidence plus keyboard and assistive-technology reasoning. Use for any user or operator interface.
---

# forge-accessibility: Accessibility

## Purpose

Audit conformance with WCAG 2.2 AA using automated evidence plus keyboard and assistive-technology reasoning.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-accessibility`, asks about accessibility, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Any user or operator interface
- Generated documents with interactive navigation

## When it does not apply

- A protocol-only library with no human-facing output

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- rendered routes
- component source
- automated accessibility command

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything.
2. State an applicability decision and the evidence supporting it.
3. Trace at least one critical flow end to end; do not infer downstream enforcement from a UI or
   declaration alone.
4. Run the safe executable checks below. Capture command, exit code, relevant output, and time.
5. Perform the manual inspections. Mark unavailable runtime or operator evidence `NOT_VERIFIED`.
6. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location.
7. In `fix` mode, separate safe fixes from approval-required changes before editing.
8. In `verify` mode, reproduce the original condition, run the stated verification, and update
   status without erasing earlier evidence.

### Concrete checks

- Check names, roles, states, landmarks, headings, labels, alternatives, contrast, zoom, reflow, target size, and status messages
- Complete all critical workflows using keyboard only
- Inspect focus order, focus trapping, restoration, errors, dynamic updates, and reduced motion

## Required inspection criteria

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

## Safe executable checks

- Run `forge accessibility audit --json` or `fullstack-forge accessibility audit --json` when
  the CLI is installed.
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review accessible names in context and screen-reader reading order
- Test high-risk custom widgets against the APG pattern

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-ACCE-001`, `FF-ACCE-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- Associate labels, restore visible focus, and add missing semantic state
- Add text alternatives supported by surrounding context

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Replacing a custom interaction or materially changing content meaning

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Re-run automated checks and keyboard walkthroughs
- Map findings to exact WCAG success criteria

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- WCAG 2.2 Level AA
- WAI-ARIA 1.2
- WAI-ARIA Authoring Practices Guide

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Prefer native HTML or platform controls before ARIA-based reimplementation

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Automated scanners cover only part of WCAG; unperformed assistive-technology tests are NOT_VERIFIED

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
