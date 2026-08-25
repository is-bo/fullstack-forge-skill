---
name: forge-ux
description: "Use automatically for user-flow and usability work, including information architecture, navigation, forms, onboarding, feedback, errors, recovery, empty states, decision complexity, and task completion."
---

# forge-ux: User experience

Engine: Upstream-powered — Impeccable

## Purpose

Use automatically for user-flow and usability work, including information architecture, navigation, forms, onboarding, feedback, errors, recovery, empty states, decision complexity, and task completion.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" ux compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves user experience, when
the user explicitly names `forge-ux`, or when discovery proves an applicable boundary.

- Interactive products
- Onboarding, forms, search, checkout, or destructive flows

## When not to activate

- Libraries with no end-user workflow

## Automated support

Relevant discovery inputs are:

- critical workflows
- routes
- analytics vocabulary
- support documentation

Deterministic support, bounded evidence only:

- `inspect-rendered-ui`
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


### Explicit external experts

- **Taste** is not bundled and is never automatic. Only when the user explicitly names it, use a separately installed copy pinned to `e988add20dab0fa97d7a76781c48961c8184288e` (`aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`). Preserve its upstream workflow instead of paraphrasing it, run it in isolated read-only advisory context, and apply these boundaries: Use only after the user explicitly requests Taste and the host exposes a separately installed, revision- or hash-verified copy. Load the upstream skill without paraphrasing or merging its full text into Forge. Run it as an isolated advisory comparison; it cannot authorize edits, dependency installation, network access, image generation, or completion claims. Repository evidence, established brand and design-system constraints, accessibility, measured performance, and Forge verification retain precedence.

If the host cannot verify or load the pinned external skill, record the advisory as
`NOT_VERIFIED`; never download it during task execution. Resolve and read
`../fullstack-forge/references/shared/external-experts.md` relative to this module skill for the
portable precedence contract. The package's `docs/EXTERNAL_EXPERTS.md` contains user installation
guidance.



## Agent inspection procedure

1. Name the user, primary task, frequency, environment, consequence of failure, essential information, risky actions, and success outcome before changing the flow.
2. Select the product's primary and adverse journeys from discovery and execute each end to end with realistic content.
3. At every step record what the user must know, which decision is required, what feedback appears, and how the user recovers without losing entered data.
4. Exercise interruption paths including expired session, back, refresh during submission, duplicate action, slow or offline network, partial data, and permission denial.
5. Check destructive actions for clear scope, confirmation, cancellation, undo or recovery, and the absence of coercive or misleading choices.
6. Identify fields, steps, and decisions that exist for the system rather than the user; treat expert usability conclusions as hypotheses when user research was not performed.

Manual inspection requirements:

- Assess information scent and cognitive load with realistic data
- Review sensitive consent and irreversible actions for user control

Stack-specific guidance:

- Test client and server transitions, including optimistic rollback

## Evidence to collect

Standards used as criteria:

- WCAG 2.2
- ISO 9241-210 concepts

## Common production failures

- Walk primary and adverse journeys from entry to durable outcome
- Inspect labels, defaults, validation timing, progress, cancellation, retry, undo, and destructive confirmations
- Verify that errors state cause and recovery and preserve user-entered data

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Clarify labels, helper text, and error recovery
- Add missing non-destructive feedback states

## Approval-required changes

- Changing workflow order, consent, or destructive-action semantics

## Verification

- Repeat representative journeys with keyboard and narrow viewport
- Confirm durable state after refresh, retry, and duplicate action

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Usability conclusions without user research are hypotheses, not verified user outcomes
