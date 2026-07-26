# Release notes — v0.3.0

Fullstack Forge v0.3.0 closes Build mode's evidence, applicability, gate, runtime, migration, and
evaluation gaps while preserving the 42-module Audit command surface. A feature can reach `done`
only through current, registered, artifact-bound evidence; `forge ship` independently re-derives its
own current evidence and treats every persisted report as diagnostics.

Remote CI, publication, provenance, release immutability, and post-publication installation are
pending until the tagged release workflow completes.

## What changed

- Build `check`, `status`, `resume`, and `done` re-derive current applicability and a code-owned
  tier gate plan. Required gates need verified `PASS`; planted snapshots and required
  `NOT_APPLICABLE` records cannot complete a feature.
- Project commands produce evidence only through an exact registered `(script, criterion)` contract.
  Internal scope, applicability, static-analysis, runtime, and design producers are a separate
  closed registry. Missing or unsupported producers remain `NOT_VERIFIED`.
- Typed evidence envelopes bind producer/version/contract, exact criterion/status, canonical root,
  working-tree revision, run identity, 24-hour expiry, environment, limitations, instance IDs, and
  one-to-one path/SHA-256/media-type artifacts. Command claims additionally bind definition, argv,
  input manifest, exit code, duration, and output digest.
- High-tier UI work has a finite runtime contract: eight product states at desktop, tablet, and
  mobile, with screenshot, keyboard, accessibility, overflow, console, and design-direction
  evidence. Partial or unavailable runtime evidence cannot pass.
- Risk acceptance is policy-, actor-, root-, revision-, file-, and expiry-bound, is refused for
  non-waivable gates, and is never rendered as `PASS`.
- Schema-v2 project framing records users/roles, outcomes, invariants, workflows, sensitive data,
  trust boundaries, expected scale, stack rationale, constraints, assumptions, unresolved decisions,
  non-goals, backlog, design alignment, and selection history.
- `forge migrate build` is the only v0.2 Build-state migration path. It validates all files before
  writing, creates hash-bound byte backups and a journal, and supports dry-run, resume, and
  rollback. Legacy positive evidence and risk acceptances become expired, untrusted diagnostics.
- Ship re-discovers and re-inspects a stable current revision. Prior report statuses, claims,
  envelopes, profiles, and module decisions never determine a release outcome. Current Ship command
  and inspector artifacts are re-hashed, and Build-domain evidence is categorically ineligible.
- Two offline public v0.3 eval corpora cover the evidence modules and twelve fixed prevention tasks,
  including intentional UI, RBAC, hostile upload, cache justification/rejection, tenancy, webhooks,
  hostile AI input, idempotent jobs, and offline behavior.

## Compatibility

Audit mode keeps its module catalog and user-facing verbs:
`forge <section> audit|fix|verify|report`, `forge all ...`, `forge ship`, installer lifecycle, and
`forge tool`. Existing reports migrate in memory and remain readable; legacy evidence that lacks a
v0.3 envelope is historical diagnostic material and cannot satisfy Ship.

Build state written by v0.2 is schema v1. v0.3 refuses to use it until the operator reviews and runs
the explicit migration:

```bash
forge migrate build --dry-run
forge migrate build
```

Interrupted migrations require `--resume` or `--rollback`; no normal Build command migrates state
implicitly.

## Supported agents

Codex and generic Agent Skills clients (`.agents/skills`), Claude Code (`.claude/skills`), Google
Antigravity (project `.agents/skills`, user `~/.gemini/config/skills`), Gemini CLI
(`.gemini/skills`), Cursor (`.cursor/skills`), Windsurf (`.windsurf/skills`), and GitHub Copilot
(`.github/skills`). `forge-new`, `forge-feature`, the master skill, schemas, references, and CLI are
synchronized as independent regular-file copies.

## Installation

Fullstack Forge is not published to the npm registry. Install the immutable Git tag after it exists:

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.3.0
npx forge init all --dry-run
npx forge init all
```

Alternatively, download the platform archive from the GitHub release, verify it against
`SHA256SUMS.txt`, and extract it at the project root. Existing installations update with
`forge update <platform>`.

## Commands

Build mode: `forge new`, `forge feature <slug> [frame|plan|check|done|accept-risk|abandon|status]`,
`forge resume`, and explicit `forge migrate build [--dry-run|--resume|--rollback]`. Audit mode
remains the independent review and release backstop. See `docs/BUILD_MODE.md`, `docs/COMMANDS.md`,
and `docs/CLI_REFERENCE.md` for the exact flag and evidence contracts.

## Evidence and safety model

The envelope proves local provenance, integrity, freshness, and contract matching; it does not turn
a bounded producer into whole-program proof and is not an externally signed attestation. Unknown
fields, unregistered producers, changed inputs/artifacts, cross-root or cross-revision reuse, stale
expiry, incomplete runtime matrices, unsupported external tools, and missing human judgment stay
`NOT_VERIFIED` or `BLOCKED`. Command output and runtime surfaces are redacted before persistence;
raw command output is represented in evidence only by its SHA-256 digest.

Build state satisfies zero Audit or Ship gates. Publication still requires the full local and remote
release gates, deterministic packages, clean installation, CI, provenance, and immutable-release
verification.

## Distribution files

The tag workflow is expected to build the versioned platform ZIP set (eight selectors plus the `all`
bundle), `SHA256SUMS.txt`, and `manifest.json`, then add the final post-tag verification record only
after draft assets are downloaded and compared byte-for-byte. Tagged source does not claim those
pending remote steps completed.

## Known limitations

- `frame` and `plan` record agent reasoning; the CLI cannot grade its quality.
- The local evidence envelope is not an external signature. A hostile same-user actor able to
  replace both executable code and state remains inside the local trust boundary.
- Browser, assistive-technology, provider, production, and human design/policy evidence requires the
  corresponding environment or reviewer. Absence is not `PASS`.
- Bounded static analyzers have documented unsupported shapes and do not prove whole-program,
  runtime, provider, or compliance correctness.
- The GitHub social preview remains a manual repository-setting check documented in
  `docs/RELEASING.md`; this source release does not claim it is configured.

## Attribution

The v0.3 implementation is original project work built on the existing published standards and
platform research recorded in `research/SOURCES.md`, `research/LICENSE_MATRIX.md`, and
`THIRD_PARTY_NOTICES.md`. No private specification or third-party skill prose is included in the
release.
