---
name: forge-discover
description: Build an evidence-backed application profile and architecture map before any specialized audit begins. Activate automatically for every repository audit when that concern is relevant to a software-engineering request.
---

# forge-discover: Project discovery

## Purpose

Build an evidence-backed application profile and architecture map before any specialized audit begins.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves project discovery, when
the user explicitly names `forge-discover`, or when discovery proves an applicable boundary.

- Every repository audit
- A changed monorepo layout or deployment model

## When not to activate

- A report-only replay with an unchanged, still-valid profile

## Automated support

Relevant discovery inputs are:

- repository root
- version-control status
- package and workspace manifests

Available deterministic support, where present:

- Use `detect-stack` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `discover-project` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-env-template` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-platform-skills` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Enumerate workspace manifests, lockfiles, and entry points, and record every application root with its package manager and language evidence.
2. Map executable surfaces: HTTP routes, background workers, scheduled jobs, CLIs, and build outputs, each with a file citation.
3. Identify data boundaries: databases, ORMs, migrations, caches, queues, object storage, and external providers from configuration and dependency evidence.
4. Identify identity boundaries: authentication providers, session mechanisms, roles, and tenant markers, distinguishing declared dependencies from wired code paths.
5. Write `.forge/project-profile.json` and `.forge/architecture-map.md` with a confidence level and file evidence for every detection, and flag low-confidence guesses for manual confirmation.

Manual inspection requirements:

- Confirm ambiguous service boundaries and critical user workflows
- Compare detected deployment topology with operator documentation

Stack-specific guidance:

- Prefer native workspace commands and manifest semantics for the detected package manager

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Create missing local .forge report directories
- Normalize a stale generated profile after discovery

## Approval-required changes

- Changing application boundaries or deployment topology
- Enabling a provider inferred only from dormant code

## Verification

- Validate project-profile.json against its schema
- Trace every architecture-map node back to profile evidence

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Runtime-only infrastructure may remain NOT_VERIFIED without operator access
