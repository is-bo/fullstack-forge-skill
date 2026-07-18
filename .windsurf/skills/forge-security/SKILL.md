---
name: forge-security
description: Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases. Use for every production-bound application.
---

# forge-security: Application security

## Purpose

Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-security`, asks about application security, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Every production-bound application
- Security-sensitive changes

## When it does not apply

- No exemption; scope may be reduced for non-executable documentation

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- project and architecture profile
- trust boundaries
- dependency and secret scan outputs

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

- Model assets, actors, entry points, trust boundaries, abuse cases, and mitigations
- Inspect injection, XSS, CSRF, SSRF, deserialization, path handling, redirects, headers, CORS, secrets, logging, and denial-of-service limits
- Run available dependency, static, and secret checks while distinguishing confirmed evidence from pattern matches

## Safe executable checks

- Run `forge security audit --json` or `fullstack-forge security audit --json` when
  the CLI is installed.
- Use `inspect-security` when present in the complete bundle; otherwise record it as unavailable, not
  successful.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review business-logic abuse and chained attack paths
- Validate production-only controls with operators

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-SECU-001`, `FF-SECU-002`, and so on. Preserve an ID across
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

- Parameterize known trust-boundary inputs, redact secrets, and add straightforward security headers
- Add allowlists and explicit size limits

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Disabling controls, rotating secrets, or changing authentication, network, or production infrastructure

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Re-run scanners and targeted exploit regression tests
- Confirm every PASS has direct evidence

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- OWASP ASVS 5.0
- OWASP Cheat Sheet Series
- NIST SSDF

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Use framework-native escaping and query parameterization at the final sink

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- This audit is not a penetration test and must not be represented as one

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
