---
name: forge-authorization
description: Verify deny-by-default function, object, role, tenant, and administrative authorization on every path. Use for any private, role-gated, owned, tenant, or administrative resource.
---

# forge-authorization: Authorization

## Purpose

Verify deny-by-default function, object, role, tenant, and administrative authorization on every path.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-authorization`, asks about authorization, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Any private, role-gated, owned, tenant, or administrative resource

## When it does not apply

- Public read-only content with no hidden data or action

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- role inventory
- private and admin routes
- policy code and tests

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

- Build a subject-action-resource-context matrix for critical resources
- Trace enforcement at server boundaries, jobs, exports, uploads, websockets, and indirect identifiers
- Test horizontal, vertical, tenant, stale-role, bulk, and confused-deputy cases

## Safe executable checks

- Run `forge authorization audit --json` or `fullstack-forge authorization audit --json` when
  the CLI is installed.
- Use `inspect-authorization` when present in the complete bundle; otherwise record it as unavailable, not
  successful.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Confirm intended role semantics and ownership transitions
- Review break-glass and support impersonation controls

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-AUTH-001`, `FF-AUTH-002`, and so on. Preserve an ID across
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

- Centralize an existing repeated policy check without semantic change
- Add negative authorization tests

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing roles, policy semantics, tenant isolation, or administrative access

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run the matrix with allowed and denied principals
- Verify denied attempts are safely logged without sensitive data

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- OWASP ASVS 5.0
- OWASP Authorization Cheat Sheet
- OWASP API1 and API5

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Never rely on UI visibility as authorization; test final data access

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Policy intent requires an authoritative owner

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
