---
name: forge-seo
description: Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering. Use for public indexable web routes.
---

# forge-seo: Search discoverability

## Purpose

Conditionally inspect public web content for crawlability, canonicalization, metadata, structured data, and rendering.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-seo`, asks about search discoverability, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Public indexable web routes
- Marketing, documentation, catalog, or editorial content

## When it does not apply

- Private applications and routes intentionally excluded from search

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- public route inventory
- robots and sitemap files
- rendered HTML

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

- Verify status codes, indexability, canonical URLs, robots directives, sitemap coverage, titles, descriptions, and social metadata
- Inspect server-rendered content, internal links, pagination, redirects, duplicate URLs, and structured-data validity
- Separate performance evidence from unmeasured assumptions

## Safe executable checks

- Run `forge seo audit --json` or `fullstack-forge seo audit --json` when
  the CLI is installed.
- Use `inspect-seo` when present in the complete bundle; otherwise record it as unavailable, not
  successful.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Judge search intent and snippet quality
- Confirm private or tenant data is never made indexable

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-SEO-001`, `FF-SEO-002`, and so on. Preserve an ID across
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

- Correct deterministic canonical, robots, or metadata omissions
- Add missing image dimensions and link descriptions

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing URL structure, redirect policy, or indexability

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Fetch representative routes as a crawler
- Validate sitemap and structured data with recorded output

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- Google Search Essentials
- Schema.org
- RFC 9110

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Inspect both framework metadata APIs and final response HTML

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Rankings and external index state cannot be promised from repository evidence

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
