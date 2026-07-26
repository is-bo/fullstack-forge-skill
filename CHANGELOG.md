# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic
versioning.

## [0.5.1] - 2026-07-26

### Added

- A Codex-facing **Forge** picker entry with the preview
  `Build · Audit · Fix · Verify · Ship · Status`, the existing brand icon, and a default prompt that
  exposes Build, Continue, Audit, Fix, Verify, Ship, Status, and Help.
- A concise ten-choice no-action beginner menu and explicit plain-language routing, including
  bounded ambiguity for `audit data` and transparent multi-area routing.
- Metadata, generated-root, no-write menu, routing, compatibility, and icon-synchronization tests.

### Changed

- The existing Codex entry is now **Fullstack Forge — Expert Audit**, preserving `$fullstack-forge`
  as the backward-compatible advanced evidence-backed audit orchestrator.
- Terminal and Codex menus use the same action names and distinguish safe-fix preview from explicit
  `--safe` application.
- Product descriptions and onboarding documentation now describe both Build and Audit workflows and
  explain that Codex uses one Forge skill rather than nested native action commands.
- Build-command platform synchronization now carries canonical router metadata and assets alongside
  `SKILL.md` while retaining ownership hashes and path/symlink protections.

### Security

- The onboarding change adds no evidence producer, alternate PASS route, implicit `--safe` or
  `--allow-run`, project-script execution, server launch, browser installation, or Build-to-Ship
  authority.

## [0.5.0] - 2026-07-25

### Added — resilient onboarding and diagnostics

- Read-only agent recommendations from finite configuration markers and executable-name hints, while
  preserving `all` as the compatible install default and never executing a detected hint.
- Bounded Doctor checks for generated-copy integrity and stable upstream release tags, with
  offline/unavailable lookups reported as warnings and exact update actions.
- Public v0.5 product requirements, gap classification, security model updates, and release evidence
  covering the simple experience and installation recovery.

### Changed

- Explicit natural-language conjunctions such as `uploads and file storage` run each named
  discipline through the existing Audit orchestrator; intrinsically ambiguous phrases still fail
  closed.
- Install success now presents Doctor, Build, Audit, and Help entry points in ordinary language.
- The onboarding demo now exercises the independent Ship gate and asserts its honest incomplete
  result when external release evidence is absent.

### Fixed

- `forge verify` now exits 2 whenever requested evidence remains `BLOCKED` or `NOT_VERIFIED`, while
  proven findings retain exit 1.
- Verify no longer rebinds stale positive findings, scope evidence, or typed gate evidence to a new
  revision without reproducing the relevant check.
- Installation now preflights the complete write set, atomically records ownership for absent
  targets before creation, atomically replaces managed files, and safely resumes after interruption
  without adopting pre-existing identical files.
- Public Markdown command tables and the documented composite-audit example now match actual
  rendering and behavior.

### Compatibility and security

- All 42 Audit modules, Build schema 2, report schema 2, finding identifiers, advanced commands,
  installer selectors, generated platform roots, and Ship independence remain compatible.
- Agent hints are advisory; inaccessible detection cannot block installation. Remote tag output is
  strictly parsed, bounded, redacted, and invoked without a shell.
- Missing, stale, unsupported, offline, provider, production, and host-UI evidence still cannot
  become `PASS`.

## [0.4.0] - 2026-07-25

### Added — simple product experience

- Simple `build`, `continue`, `audit`, `fix`, `verify`, `ship`, `status`, and `help` commands that
  route into the existing evidence-backed engines, plus a TTY menu and noninteractive command list.
- A generated `forge` Agent Skill across all platform roots, natural-language feature naming and
  audit-area mapping, typo suggestions, concise plain-language reports, and technical
  `--details`/`--json` views.
- Expanded installation success and doctor diagnostics, eight goal-oriented onboarding guides, an
  implementation gap report and product-layer design, and a tested under-ten-minute demo.

### Changed

- The generated bundle now contains 46 skills. Smoke and offline installation require the exact
  catalog and the new `forge` router in every installed platform root.
- Human install, update, uninstall, audit, fix, verify, and Ship output now prioritizes status,
  impact, safe-fix availability, evidence paths, and one next action. JSON contracts are unchanged.
- The package and deterministic archives include the onboarding guides and quickstart demo.

### Security

- Natural-language input is redacted before slugging or persistence, ambiguous mappings fail closed,
  interactive choices are closed and cancellable, and the simple layer grants no new
  command-execution, write, evidence, or Ship authority.
- Missing evidence still never becomes `PASS`; safe fixes remain explicit, registered, bounded,
  hash-current, path-contained, and link-refusing.
- Boundary analyzers no longer interpret conventional test sources as production behavior. Secret
  inspection continues to scan tests, suppressing only low-confidence values explicitly marked as
  synthetic while retaining high-confidence credential signatures.
- Forge self-release identity is now derived from the canonical executing package root. Package
  names and familiar scripts grant no release authority; only application-runtime gates become
  inapplicable for Forge itself, while ordinary unknown capability evidence remains fail-closed.
- Application-runtime pattern scans exclude generated platform copies and other classified
  non-runtime evidence without narrowing secret, CI, or configuration inspection.
- The lockfile resolves `brace-expansion` to 5.0.8, fixing GHSA-mh99-v99m-4gvg in the development
  dependency tree.

## [0.3.0] - 2026-07-22

### Added — verifiable Build completion

- A shared typed evidence-envelope primitive for Audit, Ship, and Build, with domain-separated
  producer registries; exact producer/version/contract and criterion identity; canonical root and
  working-tree revision; run, production, and expiry timestamps; environment and limitations; and
  one-to-one path/SHA-256/media-type artifacts. Command evidence additionally binds its detected
  definition, argv, input manifest, exit code, duration, and output digest.
- A closed Build producer registry keyed by exact `(script, criterion)` pairs plus a separate fixed
  internal-adapter registry. Unsupported, missing, unauthorized, offline-blocked, or mismatched
  producers remain `NOT_VERIFIED`/`BLOCKED`; no generic command-success or manual-state route can
  manufacture `PASS`.
- Current Build applicability with `REQUIRED`, `SUGGESTED`, `EXCLUDED`, and `UNRESOLVED` decisions,
  classified activation evidence, append-only selection history, and a pure tier gate registry.
  Every tier requires scope, applicability, bounded static evidence, and changed-behavior proof;
  standard/high tiers add applicable disciplines and detected project commands, while high adds
  capability-specific adverse, recovery, runtime, integration, privacy, and security-review gates.
- Complete schema-v2 new-project framing: users/roles, desired outcomes, invariants, workflows,
  sensitive-data classes, trust boundaries, scale, stack rationale, constraints, assumptions,
  unresolved decisions, non-goals, backlog, and design alignment.
- A finite Build runtime adapter for loading, empty, error, success, permission-denied, disabled,
  destructive-confirmation, and long-content states at desktop, tablet, and mobile viewports, with
  rendered artifacts, keyboard/accessibility/overflow observations, and explicit design-direction
  evidence.
- Explicit `forge migrate build` schema-v1 to schema-v2 migration with full pre-validation,
  hash-bound byte backups, an interruption journal, atomic writes, `--dry-run`, `--resume`, and
  `--rollback`. Legacy positive evidence and risk acceptances migrate only as expired, untrusted
  diagnostics.
- Two public v0.3 evaluation corpora. The module corpus exercises 12 evidence, gate, runtime,
  producer, and migration cases. The prevention corpus materializes the 12 fixed product tasks and
  tests real applicability/gate/runtime/envelope behavior while keeping nondeterministic,
  human-required, and unsupported external checks out of `PASS`.

### Changed

- `forge feature <slug> check`, `status`, `resume`, and `done` re-derive applicability and the gate
  plan for the current revision. `done` re-verifies every positive envelope in memory, reopens stale
  completed features, and requires verified `PASS` for each required gate; persisted snapshots and
  `NOT_APPLICABLE` cannot satisfy a required gate.
- Risk acceptance is a typed, expiring lifecycle bound to the current gate policy, root, revision,
  complete relevant-file hashes, and an accountable actor for operational decisions. Non-waivable
  gates reject it, and it is never rendered as `PASS`.
- `forge ship` now re-discovers and re-inspects a stable current revision. Prior report findings,
  statuses, evidence, envelopes, profiles, and module decisions are historical diagnostics only;
  current registered Ship evidence is re-hashed at consumption, and Build-domain evidence remains
  categorically ineligible.
- Audit CLI verbs and the 42-module catalog remain compatible. Legacy Audit evidence without a v0.3
  envelope stays visible after in-memory report migration but cannot satisfy Ship.

### Security

- Ship command output, definitions, argv, ledgers, and error surfaces pass through shared redaction;
  evidence retains only a digest of raw command output. Runtime URLs reject credentials and redact
  query values before persistence.
- Package inventory is allowlist-driven and explicitly rejects private specifications, local audit
  state, credentials, logs, temporary research, path traversal, absolute paths, and symlinks.
- Planted statuses, producer names, gate plans, applicability snapshots, old reports, changed
  command definitions, stale artifacts, and cross-root/revision envelopes no longer create a passing
  outcome.

### Fixed

- Build criteria can no longer be satisfied by self-reported or unregistered evidence, silent
  discipline omission, an incomplete runtime claim, a stale project index, or an implicit/mixed
  state migration.
- Ship no longer trusts editable prior report outcomes as release evidence and preserves rejected
  claims only as `NOT_VERIFIED` diagnostics.
- Platform synchronization now skips byte-identical ownership manifests and uses a bounded,
  Windows-only retry for transient sharing locks without masking permanent write failures.

## [0.2.0] - 2026-07-20

### Added — Build mode

Build mode: a second, additive mode for starting a project or implementing a feature with a
production-quality engineering workflow, alongside the existing audit/fix/verify/ship system.

- Two new CLI verbs, dispatched before module-slug parsing: `forge new` (new-project foundation —
  product frame, users/roles, business rules, risk-class inputs, stack decision with rationale,
  non-goals, design direction, initial feature list) and `forge feature <slug> [sub]` (full feature
  lifecycle: `frame`, `plan`, `check`, `done`, `accept-risk`, `abandon`, `status`, or no sub-verb to
  resume). `forge resume` lists unfinished features or resumes the most recent.
- Two new command skills, `forge-new` and `forge-feature`, generated and synchronized to all six
  platform roots alongside the 42 audit command skills, plus a compact two-mode router at the top of
  the master `fullstack-forge` skill.
- Three risk tiers (`light`, `standard`, `high`) computed from recorded product- and feature-level
  inputs, each with its own gate and plan/design requirement.
- Persistent build state under `.forge/build/` (`project.json`, `features/<slug>.json`,
  `DECISIONS.md`, `DESIGN.md`), validated fail-closed on every load, with per-file SHA-256 evidence
  freshness, redaction of agent-authored free text, and a criterion-scoped repair-cycle cap of 2.
- 42 hand-authored build-discipline briefs (`config/build-guidance.json`, rendered to
  `references/build/<slug>.md`), one per audit-module slug, with CI-enforced exact slug-set
  coverage.
- `docs/BUILD_MODE.md`: the complete build-mode guide.

Additive and non-breaking: no audit-side behavior changed. The 42-module audit catalog, finding
schema, gate registry, and every existing CLI verb are unchanged. `frame` and `plan` are recorded
guidance; `check` and `done` are CLI-enforced from real evidence, never agent-asserted; and build
state under `.forge/build/` satisfies zero `forge ship` or `forge all audit` gates — both always
re-derive their own evidence independently. `forge update <platform>` refreshes installed skills to
pick up the two new command skills.

### Fixed

- README install commands now pin the released tag, and `check:install-docs` fails whenever a
  non-historical document pins a tag other than the package version.
- Independent pre-release review hardening: a reloaded `PASS` on a `discipline:*` criterion is
  demoted to `NOT_VERIFIED` (the check deriver never produces one), `tier_inputs` pass redaction
  before persistence, and the high-risk tier floor is re-applied at `plan`, `check`, and `done`
  rather than only at `frame`.

## [0.1.10] - 2026-07-20

Discovery evidence classification and specification traceability milestone. Discovery now records
what kind of evidence each signal is, so weak signals stop activating production capabilities, and
every authoritative requirement carries published, machine-checked traceability evidence.

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

### Changed

- Module applicability now prefers a capability assessment over the legacy capability presence map.
  `capabilityStatusFor` projects a `CapabilityAssessment` onto the v0.1.8 module-decision capability
  axis, and `decisionFindingStatus` remains the canonical mapping to `NOT_APPLICABLE` and
  `NOT_VERIFIED`. The projection never strengthens a claim: `UNKNOWN` stays `UNKNOWN` and is never
  reported as a proven absence. Across a monorepo, `PRESENT` in any workspace wins, `ABSENT`
  requires every workspace to prove absence, and anything else is `UNKNOWN`.
- The evidence layer models sixteen capabilities while module decisions are gated on twenty-four. A
  capability the layer does not model produces no assessment, and that silence is not read as
  evidence; those capabilities continue to use the legacy presence map rather than being reported
  `UNKNOWN` forever.

### Fixed

- The specification traceability matrix no longer carries integration placeholders. All four
  placeholder entries are replaced with the exact merged files, tests, documentation, and release
  evidence, and `integration_placeholders` is now empty. Two attributions were wrong and were
  corrected: the static security analyzer (`FF-MOD-15`) belongs to v0.1.7, not v0.1.9, and the
  repository-wide orchestrator (`FF-ORCH-01`) belongs to v0.1.8 and v0.1.9, not v0.1.7. Every
  remaining attribution was re-checked against the commit that introduced each referenced file.

## [0.1.9] - 2026-07-20

Audit orchestration and report-output milestone. A normal `forge <section> audit` becomes one
coherent, explicitly authorized operation whose planned checks, executions, refusals, and runtime
evidence all reach the report through the v0.1.8 typed ledgers.

### Added

- Audit orchestration. A normal `forge <section> audit` is now one coherent operation: it discovers
  applicable modules, detects candidate project checks, builds a deterministic planned-check list,
  executes only what it is explicitly authorized to execute, and records every check it did not run
  together with the reason. `--json` output gains `planned_checks`, `check_outcomes`,
  `runtime_evidence`, and `evidence_complete`.
- New audit options, each of which changes behavior rather than being parsed and ignored:
  `--check <name>` and `--skip-check <name>` (repeatable, accepting either the full check identifier
  or the bare name, rejecting unknown values), `--url <url>` to integrate rendered evidence from an
  application the operator already started, and `--evidence-dir <path>` to relocate collected
  runtime evidence beneath the audited root.
- Project-command execution during an audit is restricted to a bounded allowlist of read-only
  scripts, so an audit can never start an unrecognized project server. Execution requires
  `--allow-run`. Under `--offline` a project command is refused before the process is spawned unless
  it is one of the two structurally provable exemptions from v0.1.7; every arbitrary audited-project
  script is `UNKNOWN` and is blocked. Browser tooling is never installed automatically.
- Requested evidence fails closed. A rendered capture that is `PARTIAL`, `BLOCKED`, or `FAILED`
  leaves the rendered criteria `NOT_VERIFIED` and makes the audit exit `2` — nothing failed, but the
  run did not prove what it was asked to prove.
- Report-mode output contract. `forge <section> report` renders Markdown to stdout, JSON under
  `--json`, and writes `report.json` plus `report.md` under `--output <directory>`; adding
  `--dry-run` prints the planned paths and writes nothing. Report mode never re-runs an audit, so
  the rendered document preserves the identity, revision, timestamps, and evidence of the run it
  names.
- Report output is contained and owned. The directory is resolved beneath the authorized root;
  traversal, absolute, drive-qualified, UNC, and symlinked destinations are refused. Forge records
  the digest of each file it writes and refuses to overwrite either an unowned pre-existing file or
  managed output that was edited after Forge wrote it; identical content is preserved rather than
  rewritten.

### Changed

- An `AuditLedgerSink` boundary separates orchestration from the report schema. `ReportAuditLedger`
  is the shipped implementation: it writes the v0.1.8 `planned_checks`, `runtime_evidence`, and
  `tools` ledgers through the append-only `cli/src/ledger.ts` API, so the ledger itself enforces
  that an outcome is never rewritten from weaker to stronger.
- Orchestration records an executed project command as a `project-owned`, `untrusted` tool with an
  `unknown` version source, because Forge did not author it and cannot attest to what it checked.

### Fixed

- Orchestration can no longer weaken the v0.1.7 offline policy. The planning step previously derived
  a boolean `network_dependent` flag from keyword scanning alone, so an arbitrary audited-project
  script containing no recognizable network keyword — `eslint .`, `vitest run`, `tsc -p .` — was
  treated as safe to execute under `--offline`. Text inspection can prove network dependence but can
  never prove its absence, and Forge implements no operating-system network isolation, so that
  inference was unsound. Planned checks now carry a `network_policy` obtained exclusively through
  `plannedCheckNetworkPolicy`, the single sanctioned bridge into the report vocabulary. Keyword
  scanning may only escalate `UNKNOWN` to `NETWORK_REQUIRED`; nothing can downgrade a command to
  `OFFLINE_SAFE`. This is a user-visible change: `forge <section> audit --offline --allow-run` now
  refuses project commands that earlier builds of this branch would have executed.
- A planned check that nobody authorized is recorded `NOT_RUN`, never `BLOCKED`. `BLOCKED` feeds the
  `forge fix` candidate set, and an unauthorized check is not a defect awaiting remediation.

## [0.1.8] - 2026-07-20

Module applicability and report evidence ledger milestone. `NOT_APPLICABLE` now means only that a
capability provably does not exist, and the report gained typed ledgers for tools, planned checks,
runtime evidence, and module decisions.

### Added

- Machine-readable module applicability decisions (`module_decisions`) recording capability presence
  and selection independently, so a module skipped for a scoping reason is no longer
  indistinguishable from one whose capability does not exist.
- Report schema version 2 adding `tools`, `planned_checks`, `runtime_evidence`, and
  `module_decisions` ledgers, documented in [report schema](docs/REPORT_SCHEMA.md). Reports from
  v0.1.3 through v0.1.7 migrate in memory without rewriting the source file and without fabricating
  ledgers the writing release never recorded.
- Append-only ledger APIs in `cli/src/ledger.ts` that validate input, deduplicate stable IDs,
  preserve deterministic order, and refuse to rewrite a blocked or unverified result as passing.
- `plannedCheckNetworkPolicy`, the single sanctioned bridge from the v0.1.7 command network policy
  to the coarser report vocabulary. The mapping is one-way: the two structurally provable exemptions
  become `OFFLINE_SAFE` and `UNKNOWN` always stays `UNKNOWN`. There is no inverse and no promotion
  path, so the report vocabulary cannot be used to describe an arbitrary audited-project command as
  offline-safe.

### Changed

- A module excluded by `--risk high` is now reported instead of omitted. Previously a non-high-risk
  module vanished from the report entirely, which read as though it had been audited and cleared. It
  now appears with a `NOT_VERIFIED` status and an `EXCLUDED_BY_RISK` module decision. This is a
  user-visible change to `forge all audit --risk high` output: reports contain entries for modules
  that earlier releases silently dropped, and any tooling that treated absence as success must now
  read `module_decisions`.

### Fixed

- `NOT_APPLICABLE` is now reserved for a capability that provably does not exist. A module left out
  of the changed scope, excluded by a risk filter, or whose capability could not be determined is
  reported `NOT_VERIFIED` instead of being labelled inapplicable.
- Risk-filtered modules previously vanished from the report entirely, leaving no record that they
  had gone unaudited. They now appear with an `EXCLUDED_BY_RISK` decision.
- Capability ship gates are no longer dismissed as `NOT_APPLICABLE` when the prior audit shows the
  module exists but was not audited, so narrowing an audit can no longer switch a release gate off.
- Report migration no longer claims a v0.1.7 report was written by v0.1.6. v0.1.7 changed no report
  field, so the two releases are indistinguishable from a report alone; the migration record now
  names both and states why they cannot be told apart rather than asserting a precision it does not
  have.

## [0.1.7] - 2026-07-20

Offline command policy and structural security proof milestone. `--offline` now reaches every
command execution path rather than the rendered-UI driver alone, and analyzer protection is granted
only from analyzed structure, never from an identifier's name.

### Fixed

- `--offline` is enforced on every command execution path, not only the rendered-UI driver.
  `forge tool run-project-command` and every `forge ship` gate previously spawned the audited
  project's own scripts with unrestricted network access while the report recorded `offline: true`.
  Arbitrary audited-project scripts are now classified `UNKNOWN` from their definition (never their
  name) and blocked offline. Fullstack Forge implements no operating-system network isolation, so
  none is claimed: `sandbox` is always reported as `none`. Only two exemptions are provable —
  Forge's own repository scripts, matched by exact definition and only when the audited root is
  canonically the Forge package root, and explicitly designed cache-only installation checks that
  combine an offline package-manager flag with an unreachable registry. Every command now carries a
  ledger record (`RAN`, `BLOCKED`, `NOT_RUN`) with its reason, and a blocked command produces no
  execution record and no typed evidence, so it can never satisfy a release gate.
- Security protections are no longer granted from a function's name. `parse`, `validate`,
  `assertValid`, `sanitize`, `allowlist`, `assertAllowed`, `requireAllowed`, `allowedValue`,
  `trusted`, and `safe` are discovery hints only; a no-op function with any of those names now
  leaves the SQL, shell, SSRF, redirect, mass-assignment, upload, and AI findings reported.
  Protection is recognized only from bounded structural evidence: supported library APIs with known
  semantics, schema operations attached to the exact value, dominating guards whose deny branch
  terminates, specification-defined sink encoding, parameterized database calls, shell argument
  separation, and same-file helpers whose bodies are actually analyzed.
- SSRF address guards are no longer credited from their names. `isPrivate`, `isLinkLocal`,
  `isInternal`, and `privateAddress` were still recognized by name alone, so a no-op guard —
  `function isPrivate(value) { return false; }` — suppressed the SSRF finding while blocking
  nothing, contradicting the documented claim that no protection is granted from an identifier's
  name. A guard is now credited only when a same-file implementation is analyzed: it must accept the
  value under test, reference it, and decide against concrete loopback, private, or link-local
  address evidence, and a constant-returning body proves nothing. A guard imported from another
  module is not modeled, so that mitigation is reported as unverified instead of credited. Genuine
  structurally proven address guards continue to suppress.
- Destination maps require strong proof before they suppress SSRF. A `const` object of URL strings
  is no longer sufficient: `http://127.0.0.1:3000/` and `http://169.254.169.254/latest/meta-data/`
  are fixed literals and exactly the destinations an SSRF attack wants. Suppression now requires
  fixed literal destinations, demonstrable immutability, no property write or delete, no alias
  escape, no export or return, no pass to an unmodelled function, direct flow to the sink, an
  explicit redirect constraint, absent credentials, a supported protocol, and classification of
  literal addresses — loopback, private, link-local, unspecified, multicast, reserved,
  shared-carrier, and cloud-metadata destinations all fail, including IPv4-mapped IPv6 and
  trailing-dot `localhost` forms. Hostname destinations are recorded as DNS-dependent rather than
  implied resolved.

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

[Unreleased]: https://github.com/thethunderbolt/fullstack-forge-skill/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.5.1
[0.5.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.5.0
[0.4.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.4.0
[0.3.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.3.0
[0.2.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.2.0
[0.1.10]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.10
[0.1.9]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.9
[0.1.8]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.8
[0.1.7]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.7
[0.1.6]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.6
[0.1.5]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.5
[0.1.4]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.4
[0.1.3]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.3
[0.1.2]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.2
[0.1.1]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.1
[0.1.0]: https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.0
