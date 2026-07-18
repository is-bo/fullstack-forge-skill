---
name: forge-ui
description: Inspect rendered interfaces for responsive behavior, hierarchy, state clarity, consistency, and visual defects. Use for web, mobile, or desktop interfaces.
---

# forge-ui: User interface

## Purpose

Inspect rendered interfaces for responsive behavior, hierarchy, state clarity, consistency, and visual defects.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-ui`, asks about user interface, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Web, mobile, or desktop interfaces
- Component libraries

## When it does not apply

- Headless services with no operator or user interface

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- frontend applications
- routes
- design tokens
- running-app URL when available

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

- Inspect the running application at representative small, medium, and wide viewports where possible
- Verify loading, empty, error, success, disabled, focus, hover, and long-content states
- Check semantic tokens, typography hierarchy, spacing rhythm, image dimensions, overflow, and reduced motion

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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

## Safe executable checks

- Run `forge ui audit --json` or `fullstack-forge ui audit --json` when
  the CLI is installed.
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Compare critical screens across themes and input methods
- Judge visual hierarchy and brand consistency from captured evidence

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-UI-001`, `FF-UI-002`, and so on. Preserve an ID across
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

- Add missing accessible labels or non-breaking responsive constraints
- Correct token use and layout-shift-causing dimensions

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing the product's visual language or interaction model

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Reinspect changed screens at 320, 375, 768, 1024, and 1440 CSS pixels
- Confirm keyboard focus and no unintended horizontal overflow

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- WCAG 2.2
- WAI-ARIA Authoring Practices Guide
- Core Web Vitals

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use native framework semantics and preserve server/client rendering boundaries

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Do not claim browser or device inspection unless it actually ran

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
