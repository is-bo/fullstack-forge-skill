---
name: forge-discover
description: Build an evidence-backed application profile and architecture map before any specialized audit begins. Activate automatically for every repository audit when that concern is relevant to a software-engineering request.
---

# forge-discover: Project discovery

## Purpose

Build an evidence-backed application profile and architecture map before any specialized audit begins.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves project discovery, when
the user explicitly names `forge-discover`, or when discovery proves an applicable boundary.

- Every repository audit
- A changed monorepo layout or deployment model

## When not to activate

- A report-only replay with an unchanged, still-valid profile

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- repository root
- version-control status
- package and workspace manifests

Available deterministic support, where present:

- Use `detect-stack` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `discover-project` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-env-template` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-platform-skills` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Enumerate workspace manifests, lockfiles, and entry points, and record every application root with its package manager and language evidence.
3. Map executable surfaces: HTTP routes, background workers, scheduled jobs, CLIs, and build outputs, each with a file citation.
4. Identify data boundaries: databases, ORMs, migrations, caches, queues, object storage, and external providers from configuration and dependency evidence.
5. Identify identity boundaries: authentication providers, session mechanisms, roles, and tenant markers, distinguishing declared dependencies from wired code paths.
6. Write `.forge/project-profile.json` and `.forge/architecture-map.md` with a confidence level and file evidence for every detection, and flag low-confidence guesses for manual confirmation.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Confirm ambiguous service boundaries and critical user workflows
- Compare detected deployment topology with operator documentation

Stack-specific guidance:

- Prefer native workspace commands and manifest semantics for the detected package manager

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

- Agent Skills Specification
- C4 model concepts

## Common production failures

- Detect languages, frameworks, package managers, applications, data stores, queues, providers, tests, CI, and deployment files
- Map public, private, admin, tenant, upload, payment, and AI boundaries with file evidence
- Record a confidence level and evidence list for every detected capability

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Languages
- Frameworks
- Monorepo layout
- Package managers
- Frontend applications
- Backend applications
- Mobile applications
- Desktop applications
- Databases
- ORMs
- Authentication provider
- Session implementation
- Hosting platform
- Object storage
- File-upload pipeline
- Caching and Redis
- Queues
- Scheduled jobs
- Tests
- CI/CD
- Observability
- External integrations
- AI providers
- Payment providers
- Public routes
- Private routes
- Admin routes
- User roles
- Tenant boundaries
- Critical workflows
- Environment templates
- Deployment configuration
- Confidence and file evidence for every detected technology
- Current .forge/project-profile.json and .forge/architecture-map.md outputs

## Commands and tools

- Run `forge discover audit --json` or `fullstack-forge discover audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `detect-stack` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `discover-project` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-env-template` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-platform-skills` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Create missing local .forge report directories
- Normalize a stale generated profile after discovery

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Changing application boundaries or deployment topology
- Enabling a provider inferred only from dormant code

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Validate project-profile.json against its schema
- Trace every architecture-map node back to profile evidence

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

- Runtime-only infrastructure may remain NOT_VERIFIED without operator access

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
