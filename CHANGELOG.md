# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic
versioning.

## [Unreleased]

### Added

- Discovery now classifies every signal it observes. Each detection records an evidence class
  (`manifest`, `implementation`, `configuration`, `route`, `schema`, `test`, `documentation`,
  `fixture`, `generated`, `example`, `unknown`), the path and line it came from, a confidence, an
  activation weight, a reason, and the workspace it belongs to. Only production-bearing evidence
  activates a capability: documentation, tests, fixtures, and generated Forge or platform copies
  carry zero activation weight, examples are separated from active applications, and keywords found
  in comments or passive string literals are downgraded. Capability determination returns `PRESENT`,
  `ABSENT`, or `UNKNOWN`, so a pile of weak signals now produces `UNKNOWN` instead of a false
  `PRESENT`. Assessments are computed per workspace and published in `.forge/project-profile.json`
  as `capability_assessments`. Existing language, framework, and structured discovery is unchanged.
- A public specification traceability matrix records every authoritative requirement in the
  maintainers' own words, with implementation, test, documentation, and release-verification
  evidence, a status, and honest limitations. `config/traceability-matrix.json` is the source of
  truth, `docs/TRACEABILITY_MATRIX.md` is generated from it, and `npm run check:traceability` (part
  of `npm run check`, and therefore of CI) rejects duplicate identifiers, unsupported statuses,
  missing repository paths, unevidenced `COMPLIANT` entries, unexplained `NON_COMPLIANT` entries,
  and `NOT_VERIFIED` entries that do not distinguish an external limit from unfinished local work.
  See [docs/TRACEABILITY.md](docs/TRACEABILITY.md).

## [0.1.6] - 2026-07-19

Rendered-UI security milestone. Three defects were independently reproduced against v0.1.5 before
remediation: offline mode that only checked the initial URL, rendered inspection that reported
success on incomplete evidence, and unredacted console and error text written straight to evidence.
This release completes the rendered-UI security milestone only; other deferred specification areas
are unchanged.

### Fixed

- Offline mode is now enforced across the whole browser, not just the first URL. v0.1.5 validated
  the initial destination and then navigated with no further checks, so a loopback page could still
  reach the network through redirects, scripts, styles, fonts, images, frames, workers, fetch, or
  XHR. Rendered inspection now intercepts every request and aborts non-loopback HTTP/HTTPS
  destinations before they are sent, so no DNS lookup or connection occurs for a blocked request.
  Blocked destinations are recorded as redacted evidence and prevent a complete capture. A driver
  that cannot intercept requests is refused instead of silently downgraded. WebSocket construction
  is guarded inside the page; transports outside interception and that guard are reported
  `NOT_VERIFIED` rather than claimed as blocked.
- Loopback classification moved into a shared network-policy module and now covers `localhost`,
  `*.localhost`, the whole `127.0.0.0/8` range, `::1`, IPv4-mapped IPv6 loopback, and trailing-dot
  and case variants. Private, link-local, and cloud-metadata addresses are never treated as
  loopback.
- Rendered inspection now fails closed. v0.1.5 could exit `0` with a rendered `PASS` when only one
  of three viewports succeeded, and exited `0` with no finding at all when every viewport failed.
  Each run now reports `capture_status` (`COMPLETE`, `PARTIAL`, `BLOCKED`, `FAILED`) plus a
  per-viewport record, and only `COMPLETE` with zero console errors may produce the informational
  `FF-UI-RENDER-001` `PASS`. Any other status produces `FF-UI-CAPTURE-001` and leaves the rendered
  criteria `NOT_VERIFIED`. A screenshot that resolves without writing a readable artifact is now a
  failure rather than counted evidence. Partial evidence is preserved, the manifest and CLI result
  always agree, and browser cleanup runs on every launch-success path with close failures recorded.
- All rendered evidence passes through one shared redaction layer before it is written, printed, or
  turned into a finding. v0.1.5 wrote raw console text, page errors, and navigation errors into
  `console.json` and findings, which could carry tokens, cookies, query values, and local paths.
  Redaction removes URL userinfo, query values, and fragments; authorization, cookie, session, and
  API-key assignments; JWT-shaped and vendor-prefixed keys; residual high-entropy credentials; and
  home-directory paths. Output is length-bounded and states whether it was redacted, truncated, or
  both. SHA-256 digests are preserved because they are evidence, not secrets.
- Fixed a double `browser.close()` on the offline path that refuses a non-intercepting driver, found
  by the new regression tests.

### Changed

- The rendered-UI evidence manifest is now `schema_version: 2`, adding `capture_status`,
  `viewports`, and `blocked_requests`. `RenderedUiResult` gains the same fields. Report loading for
  earlier versions is unchanged.
- The secret scanner now exempts explicitly self-identified synthetic values under test roots as
  well as `fixtures/`, so redaction tests can embed credential-shaped sentinels. An unmarked secret
  committed to a test still fails the scan.

## [0.1.5] - 2026-07-19

Trust-boundary and honest-evidence patch. Four defects were independently reproduced against v0.1.4
before remediation: a dead `--offline` flag, unauthorized execution of audited-project code through
browser-driver import, name-based SSRF protection proof, and rendered evidence that overwrote itself
on every run.

### Fixed

- `--offline` is now enforced rather than parsed and discarded. It refuses non-loopback destinations
  before DNS resolution is attempted, refuses audited-project browser-driver resolution, and reports
  network-dependent checks as `BLOCKED`/`NOT_VERIFIED` instead of `PASS`. The flag is recorded in
  the report environment ledger and in every evidence manifest.
- Rendered-UI inspection no longer imports browser tooling from the audited project by default.
  Importing a package executes its top-level code, so a hostile repository could previously run
  arbitrary code inside the auditor's process — including under `--dry-run` and for loopback URLs
  with no `--allow-run`. Drivers are now resolved from the Fullstack Forge package root first; the
  audited project's copy requires explicit `--allow-run`, real-path containment inside the audited
  repository, and is refused under `--offline`. `--dry-run` resolves, imports, and launches nothing.
- SSRF protection is no longer granted from identifier names. `mapDestination`,
  `trustedDestination`, `resolveAllowedDestination`, `assertAllowed`, uppercase constants, and
  request-owned objects named `ALLOWED_DESTINATIONS` or `TRUSTED` no longer suppress a finding.
  Destination proof now requires a `const` declaration initialized with an object literal whose
  every value is a fixed absolute http(s) URL literal, or a dominating guard bound to the same
  tainted value as the sink.
- Rendered evidence is written per revision, run, and route instead of to fixed filenames, so
  multiple routes and repeated runs no longer destroy one another. Manifests record the revision,
  redacted source and final URL, redirect state, viewport dimensions, driver identity and version,
  per-screenshot SHA-256 hashes, console-output hash, authorization state, offline state, and
  limitations from partial captures. URL credentials are rejected and query values are redacted
  before reaching any artifact or directory name; partial browser failures preserve honest partial
  evidence and always close the browser.

### Added

- An `environment` ledger in the report schema recording operating system, platform, architecture,
  Node version, Forge version, offline mode, and execution authorization. The field is optional, so
  v0.1.3 and v0.1.4 reports continue to load and render, stating the absence rather than
  back-filling it.
- `npm run check:install-docs`, which fails the build when documentation presents the unpublished
  npm registry installation as currently usable.

### Changed

- The README now leads with the Git-tag installation that works today. The registry form is retained
  only under an explicit "after npm registry publication" heading and marked NOT YET AVAILABLE.
- Use the canonical tag release URL in post-tag evidence instead of GitHub's temporary draft URL.
- Update both CodeQL v4 steps together to the verified v4.37.1 commit.
- Add the completed v0.1.4 post-release verification record; the immutable tag and release remain
  unchanged.

## [0.1.4] - 2026-07-19

Security-correctness and release-integrity patch. The supplied defects were independently reproduced
before remediation; fixture dependency pollution, sink-agnostic taint clearing, authorization
keyword proof, same-file finding collisions, broad ship-gate inference, missing adapter output,
non-enforced coverage, and mutable release upload behavior were confirmed.

### Fixed

- Replaced global sanitizer clearing with scope-aware taint plus typed, sink-specific protection
  evidence. Generic parsing, validation, encoding, or escaping no longer makes SQL, shell, SSRF, or
  another unrelated sink safe.
- Authorization evidence must now be structurally connected to the released object through an
  owner/tenant predicate or a dominating subject-and-object guard. Strings, unused imports,
  post-release calls, and guards for another object do not suppress findings.
- Finding identity now incorporates path, containing scope, receiver, sink, structural AST shape,
  and a deterministic same-scope occurrence discriminator. Fix planning, writes, verification,
  refusals, report updates, and rollback all retain the exact `instance_id`.
- Ship gates consume typed, revision-bound evidence. Secret, dependency, lockfile, license,
  authorization, tenant, upload, migration, test, and artifact records cannot satisfy unrelated
  gates; missing, failed, or stale evidence fails closed.
- Normal CLI audits now emit structured per-module language/framework coverage and name the exact
  missing adapter. Unknown Python projects are no longer assumed to use FastAPI.
- Scanner fixtures use non-installable `package.json.fixture` sentinels and materialize manifests
  only in disposable tests, removing them as repository dependency roots without changing security
  cases.
- The public finding schema now matches runtime instance-specific verification and fix-attempt
  fields, including safe scoped-action validation.

### Security and release engineering

- Updated checkout, setup-node, and upload-artifact to reviewed major versions pinned to immutable
  full commit SHAs; added a pinned no-build CodeQL workflow.
- Coverage is an executable CI gate with committed overall and risk-focused per-file floors.
- The release workflow refuses an existing release or moved tag, has a concurrency guard, never
  clobbers an asset, verifies draft downloads byte-for-byte, attaches checksummed final evidence,
  publishes once, and verifies immutable release and asset attestations.
- Tagged source contains honest completed local verification with remote steps marked pending; the
  tag workflow publishes a separate final evidence asset that explicitly was not inside the tag.
- GitHub immutable releases were enabled directly for future releases; historical tags and releases
  remain unchanged.

### Additional corrections

- Removed tenant-background false positives caused merely by the `export` keyword.
- Stopped treating raw SQL `.query` calls as authorization object lookups.
- Invalidated typed protections after raw reassignment and rejected conditional or non-dominating
  authorization calls as proof.
- Kept identical-peer instance IDs stable after a sibling fix; fix and verification now refresh the
  report revision, preserve typed evidence, and record exact-instance rollback attempts.
- Made secret scanning tolerate unstaged tracked deletions without dropping untracked files.
- Made coverage parsing accept native and Windows-rendered Node information prefixes.
- Added exact release-document validation, deterministic fixture validation, distribution evidence
  docs, exact draft asset/manifest verification, and coverage for filesystem and archive safety
  branches.

## [0.1.3] - 2026-07-19

Corrective correctness release. Thirteen reported problem areas were independently reproduced
against source before any change; twelve confirmed, two narrowed to partially confirmed. See
`docs/AUDIT_CLASSIFICATION_v0.1.3.md` for the per-issue evidence.

### Fixed

- A refused automatic fix no longer overwrites a proven `FAIL` or `WARNING` with `BLOCKED`. Defect
  status, fix-attempt status, and verification status are now distinct, with refusals recorded in a
  new `fix_attempts[]` structure on the finding.
- `--safe` was parsed but never read, making `forge <section> fix` and `forge <section> fix --safe`
  identical and both mutating. `fix` now plans only; `fix --safe` executes bounded safe registry
  entries; `fix --safe --dry-run` plans without writing.
- Findings gained a stable `instance_id` so separate occurrences of one rule no longer merge, and
  verifying a resolved occurrence is no longer re-failed by an unrelated occurrence elsewhere.
- `verify --dry-run --allow-run` executed project commands. A dry run now executes nothing.
- Analyzer verification re-ran over the whole repository; it is now scoped to the original evidence
  paths and matched on instance identity.
- Ship gates marked every command-backed internal gate `NOT_APPLICABLE` and `required: false` for
  non-Forge projects, silently disabling secret scanning, dependency inspection, and license
  validation for every audited application. Gates now declare a `forge-self`, `audited-application`,
  or `project-native` applicability class.
- Removed an unreachable dependency-evidence branch in the gate loop.
- Changed-scope base resolution no longer falls back to `HEAD`, which hid every committed branch
  change. Precedence is `--base`, upstream, `origin/HEAD`, `origin/main`, `origin/master`, local
  `main`, local `master`, then a structured `BLOCKED`.
- Repository confidence used a `.git/` path test inside a walk that excludes `.git`, so it could
  never be true. It now uses `git rev-parse --is-inside-work-tree`.
- Every nested `package.json` was reported as a high-confidence active workspace. Workspaces are now
  resolved from declared configuration; undeclared manifests are low-confidence `nested-package`
  records.

### Added

- `cli/src/dataflow.ts`: bounded intra-file taint engine resolving aliases, reassignment,
  destructuring, template and concatenation propagation, and same-file parameter summaries, with
  source-to-sink trace evidence. Sanitizers bind to the specific tainted value instead of being
  inferred from nearby keywords.
- `cli/src/support.ts`: structured analyzer support registry with per-module coverage levels,
  supported and unsupported shapes, and named required adapters for missing coverage.
- Bounded route adapters for Next.js App Router, Next.js Pages Router, NestJS decorators, and
  Fastify object-form routes. Name-based route visibility is now `LOW` confidence and discloses the
  heuristic.

### Notes

- `docs/RELEASE_VERIFICATION_v0.1.2.md` was never committed; v0.1.2 shipped without a verification
  record. This is documented rather than backdated.
- Test total moved from 117 to 164 with no existing test removed or weakened.

## [0.1.2] - 2026-07-19

Independent audit response. Every finding from the v0.1.1 conformance audit is addressed with
executable evidence rather than documentation.

### Added

- Authentication analyzers for weakened session-cookie attributes (`FF-AUTH-COOKIE-001`) and
  request-derived session identifiers (`FF-AUTH-SESSION-001`). The `broken-auth` fixture previously
  produced no automated finding despite `httpOnly: false`, `secure: false`, and a user-controlled
  cookie value.
- Security analyzers for SSRF (`FF-SEC-SSRF-001`), unsafe deserialization and code evaluation
  (`FF-SEC-DESERIALIZE-001`), CSV formula injection (`FF-SEC-CSV-001`), and mass assignment
  (`FF-SEC-MASS-ASSIGN-001`), each with a dedicated fixture case.
- `inspect-rendered-ui`, a 25th executable tool that captures desktop, tablet, and mobile
  screenshots plus browser console output into `.forge/evidence/ui/` using the audited project's own
  Playwright installation. It reports `BLOCKED` when Playwright or a reachable URL is absent,
  refuses non-loopback destinations without `--allow-run`, never launches project servers, and emits
  `FF-UI-CONSOLE-001` for console errors.
- Per-module inspection procedures in `config/module-procedures.json`: 212 discipline-specific steps
  replacing the single generic eight-step block that every module previously shared.
- `npm run offline:install`, verifying that the packed artifact installs with `--offline`
  (cache-only, no network requests) and generates all six platform roots against an unreachable
  registry.
- `npm run test:coverage` using Node's experimental coverage reporter.
- Build-provenance attestation for every published release archive.
- A measured text-overlap comparison in `research/LICENSE_MATRIX.md`: zero shared eight-word
  sequences across 1,967 upstream Markdown files and 766,216 shingles from all eleven researched
  repositories.

### Changed

- CI runs on macOS in addition to Linux and Windows, fails on stale committed `build/` output, and
  verifies offline installation.
- The release workflow derives its notes path from the tag instead of hard-coding v0.1.1, and drops
  workflow-level write permission in favor of job-scoped tokens.
- Smoke installation asserts the CLI version from `package.json` rather than a hard-coded string.
- `research/SOURCES.md` records a per-row retrieval date for each vendor documentation source, which
  is not version-addressable the way a Git commit is.
- 26 of 32 evaluation cases now assert a stable automated finding ID, up from 9 of 26.

## [0.1.1] - 2026-07-18

### Added

- Typed JavaScript/TypeScript analyzers for supported security, authorization, tenancy, upload,
  query, cache, accessibility, AI, payment, and integration boundaries, with executable fixture
  evaluations and finding-specific verification plans.
- A bounded safe-fix registry for environment-template placeholders, JSX reverse-tabnabbing
  protection, and existing Vercel global header rules, including dry runs, exact audit hashes,
  idempotency, rollback metadata, and risky-change refusal.
- Git-aware changed-scope analysis with merge-base, staged, unstaged, untracked, rename, deletion,
  import, workspace, schema, policy, route, test, and generated-artifact impact evidence.
- Project-profile schema v2 with structured applications, routes, roles, tenant boundaries,
  workflows, providers, infrastructure, and deployment records.
- An explicit Forge release-gate registry combining internal, project-native, prior-audit, and
  capability evidence.

### Changed

- Antigravity project installation remains `.agents/skills/`, while Antigravity global installation
  now uses the separately modeled `.gemini/config/skills/` destination. Gemini CLI and generic Agent
  Skills retain their distinct project and user paths.
- Verification preserves original audit evidence and distinguishes direct structural resolution,
  unresolved findings, disappeared-but-unverified patterns, blocked commands, and regressions.
- Public documentation now describes bounded analyzers and executable safe fixes without treating
  keyword inventories as complete audits.
- Distribution packaging removes only stale, manifest-owned, hash-unchanged artifacts when a version
  changes and refuses modified or unsafe ownership records.

### Historical unreleased work included

- Expanded all 42 command skills with an explicit 957-item inspection-criteria catalog and validated
  references to the bundled executable tools.
- Kept Dependabot focused on shipped dependencies by excluding deliberately noninstallable static
  fixture manifests and holding compiler/type majors to the supported Node.js 24 toolchain.

## [0.1.0] - 2026-07-18

### Added

- Canonical Fullstack Forge orchestrator and 42 self-contained command skills.
- Evidence, finding, discovery, safe-fix, completion, and release-readiness protocols.
- TypeScript CLI with discovery, scanners, reports, validation, platform installation, updates, safe
  uninstall, doctor, packaging, and ship commands.
- Generated Agent Skills copies for Claude Code, Codex/Antigravity/generic agents, Gemini CLI,
  Cursor, Windsurf/Devin Cascade, and GitHub Copilot.
- Deterministic ZIP archives, SHA-256 checksums, ownership manifests, clean-install smoke tests,
  fixtures, CI, research attribution, and original branding.

[Unreleased]: https://github.com/thethunderbolt/fullstack-forge-skill/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.4
[0.1.3]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.3
[0.1.2]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.2
[0.1.1]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.1
[0.1.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.0
