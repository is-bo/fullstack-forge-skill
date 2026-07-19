---
name: forge-frontend
description: Inspect rendering, state, network, hydration, browser security, and bundle behavior in frontend applications. Use for browser applications.
---

# forge-frontend: Frontend engineering

## Purpose

Inspect rendering, state, network, hydration, browser security, and bundle behavior in frontend applications.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-frontend`, asks about frontend engineering, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Browser applications
- Hybrid server/client rendered frontends

## When it does not apply

- Backend-only services

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- frontend manifests
- route tree
- build configuration
- network client code

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Map component and data-fetching boundaries, identify server/client splits, and trace one interactive flow from route load to rendered state.
3. Profile network behavior for fetch waterfalls, duplicate requests, and missing caching on repeat navigation.
4. Inspect state management for stale-state, race, and error-boundary gaps: determine what happens when a slow response returns after navigation.
5. Measure bundle composition and record the heaviest dependencies, missing code splitting, and unused code on the initial route.
6. Check cleanup paths for listeners, observers, timers, and subscriptions on unmount, and hydration consistency for server-rendered markup.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

- Trace data fetching, caching, cancellation, race handling, optimistic rollback, and stale-state behavior
- Inspect rendering boundaries, hydration, error boundaries, code splitting, source maps, and browser compatibility
- Check untrusted HTML, client secrets, CSRF assumptions, and sensitive storage

## Required inspection criteria

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

## Safe executable checks

- Run `forge frontend audit --json` or `fullstack-forge frontend audit --json` when
  the CLI is installed.
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Exercise slow, offline, duplicate, and out-of-order responses
- Inspect bundle composition and runtime console output when tooling is available

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-FRON-001`, `FF-FRON-002`, and so on. Preserve an ID across
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

- Add abort handling, explicit states, and deterministic lazy boundaries
- Remove confirmed client-side secret exposure

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Replacing state architecture or changing rendering strategy

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run production build and representative browser flows
- Confirm server/client output and network failure recovery

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- WHATWG HTML
- Core Web Vitals
- OWASP XSS Prevention Cheat Sheet

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Follow the detected framework's current server/client and cache semantics

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Bundle and performance claims require measured artifacts

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
