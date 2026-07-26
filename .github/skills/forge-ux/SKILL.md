---
name: forge-ux
description: Use automatically for user-flow and usability work, including information architecture, navigation, forms, onboarding, feedback, errors, recovery, empty states, decision complexity, and task completion. Activate automatically for interactive products when that concern is relevant to a software-engineering request.
---

# forge-ux: User experience

## Purpose

Use automatically for user-flow and usability work, including information architecture, navigation, forms, onboarding, feedback, errors, recovery, empty states, decision complexity, and task completion.

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
## Experience workflow and progressive references

Automatic activation signals include:

- Strong experience intent such as UX, user experience, user flows, usability, navigation, onboarding, task completion, feedback, information architecture, conversion, or friction
- Ambiguous form, booking, recovery, error, state, or flow terms only with supporting human-facing or repository evidence

Explicit agent shortcuts are `$forge ux review`, `$forge ux audit`, `$forge ux improve`, `$forge ux verify`. `review` routes to evidence-preserving `audit`;
`improve` routes to a fix preview unless safe application is explicitly authorized. Normal feature
requests do not require a command.

Use this proportional workflow: `UNDERSTAND` → `INSPECT` → `SELECT` → `DEFINE` → `IMPLEMENT` → `RENDER` → `VALIDATE` → `REFINE` → `REPORT`.
For a small bounded change, keep the same order but record decisions inline; optional templates must
not become ceremony.

Load only the references selected by the request and repository evidence:

- `product-and-ux` — load the installed bundle file `fullstack-forge/references/frontend/product-and-ux.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `accessibility-integration` — load the installed bundle file `fullstack-forge/references/frontend/accessibility-integration.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `forms-and-data-entry` — load the installed bundle file `fullstack-forge/references/frontend/forms-and-data-entry.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.
- `design-review` — load the installed bundle file `fullstack-forge/references/frontend/design-review.md` only when its **Load when** condition matches; obey its **Do not load when** exclusions.

Accessibility rules remain owned by `forge-accessibility`; localization by `forge-i18n`;
performance proof by `forge-performance`; public-search behavior by `forge-seo`. Compose those
owners instead of copying their rules here. Never load mobile, chart, motion, or framework guidance
without matching evidence.


## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Name the user, primary task, frequency, environment, consequence of failure, essential information, risky actions, and success outcome before changing the flow.
3. Select the product's primary and adverse journeys from discovery and execute each end to end with realistic content.
4. At every step record what the user must know, which decision is required, what feedback appears, and how the user recovers without losing entered data.
5. Exercise interruption paths including expired session, back, refresh during submission, duplicate action, slow or offline network, partial data, and permission denial.
6. Check destructive actions for clear scope, confirmation, cancellation, undo or recovery, and the absence of coercive or misleading choices.
7. Identify fields, steps, and decisions that exist for the system rather than the user; treat expert usability conclusions as hypotheses when user research was not performed.
8. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
9. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Assess information scent and cognitive load with realistic data
- Review sensitive consent and irreversible actions for user control

Stack-specific guidance:

- Test client and server transitions, including optimistic rollback

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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
- Named user, task, environment, and consequence of failure
- Partial, stale, offline, and interruption states
- Input preservation across validation, timeout, and session renewal
- Expert-review hypotheses distinguished from observed user evidence

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing workflow order, consent, or destructive-action semantics

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Repeat representative journeys with keyboard and narrow viewport
- Confirm durable state after refresh, retry, and duplicate action

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Usability conclusions without user research are hypotheses, not verified user outcomes

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
