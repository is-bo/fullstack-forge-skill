---
name: forge-ux
description: Evaluate real task flows for clarity, feedback, recovery, accessibility, and avoidance of user harm. Activate automatically for interactive products when that concern is relevant to a software-engineering request.
---

# forge-ux: User experience

## Purpose

Evaluate real task flows for clarity, feedback, recovery, accessibility, and avoidance of user harm.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves user experience, when
the user explicitly names `forge-ux`, or when discovery proves an applicable boundary.

- Interactive products
- Onboarding, forms, search, checkout, or destructive flows

## When not to activate

- Libraries with no end-user workflow

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- critical workflows
- routes
- analytics vocabulary
- support documentation

Available deterministic support, where present:

- Use `inspect-rendered-ui` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Select the product's critical journeys from discovery (registration, core object create/edit/delete, search, upload, payment) and execute each end to end.
3. At every step record what the user must know, what feedback appears, and how the user recovers from an error without losing entered data.
4. Exercise interruption paths: expired session mid-form, back button, refresh during submission, and permission denial, and record where work is lost or the user dead-ends.
5. Check destructive actions for confirmation, undo, and clarity about the scope of loss.
6. Measure friction: count fields, steps, and decisions per journey and flag steps that exist for the system's benefit rather than the user's.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Assess information scent and cognitive load with realistic data
- Review sensitive consent and irreversible actions for user control

Stack-specific guidance:

- Test client and server transitions, including optimistic rollback

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

- WCAG 2.2
- ISO 9241-210 concepts

## Common production failures

- Walk primary and adverse journeys from entry to durable outcome
- Inspect labels, defaults, validation timing, progress, cancellation, retry, undo, and destructive confirmations
- Verify that errors state cause and recovery and preserve user-entered data

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Navigation clarity
- Information architecture
- Workflow length
- Cognitive load
- Form friction
- Validation clarity
- Feedback after actions
- Error recovery
- Preservation of entered data
- Undo behavior
- Destructive confirmations
- Onboarding
- Search, filtering, and sorting
- Empty states
- Permission denial
- Session expiration
- Deep links
- Back-button behavior
- Progress visibility
- Cancellation and resume behavior
- Dead ends
- Perceived responsiveness
- Mobile input behavior
- Keyboard obstruction
- User control
- Registration, verification, and onboarding journey
- Login, create, edit, and delete journey
- Search, filter, open, and return journey
- Upload, validation, processing, and confirmation journey
- Expired-session login and resume journey
- Failed-payment retry and permission-denial recovery journeys

## Commands and tools

- Run `forge ux audit --json` or `fullstack-forge ux audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-rendered-ui` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Clarify labels, helper text, and error recovery
- Add missing non-destructive feedback states

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing workflow order, consent, or destructive-action semantics

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Repeat representative journeys with keyboard and narrow viewport
- Confirm durable state after refresh, retry, and duplicate action

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

- Usability conclusions without user research are hypotheses, not verified user outcomes

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
