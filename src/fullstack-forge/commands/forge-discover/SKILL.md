---
name: forge-discover
description: "Build an evidence-backed application profile and architecture map before any specialized audit begins."
---

# forge-discover: Project discovery

Engine: Forge native

## Purpose

Build an evidence-backed application profile and architecture map before any specialized audit begins.



Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

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

Deterministic support, bounded evidence only:

- `detect-stack`
- `discover-project`
- `inspect-env-template`
- `inspect-platform-skills`

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

Standards used as criteria:

- Agent Skills Specification
- C4 model concepts

## Common production failures

- Detect languages, frameworks, package managers, applications, data stores, queues, providers, tests, CI, and deployment files
- Map public, private, admin, tenant, upload, payment, and AI boundaries with file evidence
- Record a confidence level and evidence list for every detected capability

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Runtime-only infrastructure may remain NOT_VERIFIED without operator access
