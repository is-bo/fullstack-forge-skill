# Fullstack Forge v0.4 product-layer gap report

- Status: initial pre-implementation assessment
- Assessment date: 2026-07-22
- Baseline: Fullstack Forge v0.3.0, commit `b8ecf0bcc374d29990d8d7f55f37f6b2e29ecec3`

## Executive finding

The v0.3.0 engine is healthy, but the product entrance is not designed for a first-time or
nontechnical user. The existing CLI and skill bundle expose safe, evidence-backed Build and Audit
machinery through an expert grammar. They do not expose the requested simple command vocabulary,
guided entry point, natural-language feature naming, concise terminal summary, or short onboarding
path.

No evidence-integrity or installer-ownership regression was found in the baseline. The release
cannot satisfy the v0.4 product goal until the high-priority entrance-layer gaps below are closed.

## Evidence collected before changes

The assessment covered the complete tracked repository, the local product specification, canonical
and generated skill trees, CLI routing and rendering, installers, package policy, public docs,
fixtures, evaluations, release automation, and the current platform path claims. Repository content
and fetched documentation were treated as untrusted inputs; no fetched instruction was executed.

| Check                                             | Baseline result                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run check`                                   | PASS; 662 tests, 661 passed, 1 skipped, 0 failed                                                 |
| `npm run test:coverage`                           | PASS; 93.70% lines, 83.71% branches, 93.46% functions                                            |
| `npm run smoke:install`                           | PASS; packed install/update/uninstall, Antigravity and Gemini paths, 0 symlinks                  |
| `npm run offline:install`                         | PASS; 45 skills in each of 6 roots, unreachable registry, 0 symlinks, clean uninstall            |
| Generated assets                                  | PASS; 105 canonical files synchronized to all 6 platform roots                                   |
| `forge` and `forge help`                          | Exit 0, but print the dense expert reference only                                                |
| Requested simple commands                         | `build`, `continue`, `audit`, `audit all`, `fix`, `verify`, and `status` are rejected as unknown |
| Typo probe                                        | `forge autdit` is rejected without a suggestion                                                  |
| `forge doctor --json` in an uninitialized project | Node and bundle paths PASS; ownership manifest NOT_VERIFIED; process still exits 0               |

The existing smoke scripts prove the package lifecycle, but not the requested first-run product
journeys or success/failure wording. That distinction is preserved in the findings below.

## Prioritized findings

### FF-PRODUCT-001 — The simple command contract does not exist

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Baseline evidence: `cli/src/cli.ts:93` dispatches only the existing Build verbs before expert
  parsing; `cli/src/cli.ts:163` rejects every other non-module command. Direct probes reject
  `forge build`, `forge build "add customer login"`, `forge continue`, `forge audit`,
  `forge audit all`, `forge fix`, `forge verify`, and `forge status`.
- Impact: the primary workflow in the v0.4 goal is unusable. A user must already understand module
  slugs, modes, flags, evidence vocabulary, and Build phases.
- Required change: add a compatibility-preserving simple router for `build`, `continue`, `audit`,
  `fix`, `verify`, `ship`, `status`, and `help`, with deterministic mapping to the existing engines.

### FF-PRODUCT-002 — There is no `/forge` product skill

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Baseline evidence: the v0.3 `scripts/project.mjs` declared only `forge-new` and `forge-feature` as
  Build command skills; validation reports exactly 45 canonical skills (42 Audit, 2 Build, 1 main).
  Two independent tracked-source searches found no `/forge` router skill or equivalent command
  instructions.
- Impact: users must discover and remember separate expert skill names instead of one stable product
  entrance.
- Required change: generate a canonical `forge` skill into every platform root and keep the existing
  `fullstack-forge`, `forge-new`, `forge-feature`, and `forge-<area>` skills unchanged.

Codex currently documents explicit skill selection through `/skills` or `$` mentions rather than a
universal arbitrary slash-command grammar. The new skill should therefore support `/forge ...` where
the host exposes skill names as slash commands and document the equivalent `$forge ...` or
plain-language invocation where it does not.

### FF-PRODUCT-003 — No-argument use is a reference dump, not guided onboarding

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Baseline evidence: `cli/src/cli.ts:101` sends an empty argument list directly to `printHelp()`;
  `cli/src/cli.ts:812` starts with the full expert Build grammar. There is no TTY detection,
  interactive input, numbered menu, cancellation path, or noninteractive compact menu.
- Impact: the first successful invocation creates high cognitive load and offers no safe next step.
- Required change: show a keyboard-friendly guided menu on an interactive terminal and a concise
  numbered command list when stdin/stdout is noninteractive. Cancellation must make no changes.

### FF-PRODUCT-004 — Natural-language feature names cannot reach Build mode

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Baseline evidence: `cli/src/build.ts:515` treats the second positional as a pre-made slug;
  `cli/src/build-state.ts:274` accepts only the strict safe slug grammar. No normalization,
  collision handling, source-text record, or ambiguity behavior exists.
- Impact: `forge build "add customer login"` cannot work, and asking nontechnical users to invent a
  filesystem-safe identifier leaks an implementation detail.
- Required change: derive a deterministic, safe, readable slug from natural language, preserve the
  original summary, handle reserved names and collisions transparently, and never convert ambiguous
  intent into a silent security or product decision.

### FF-PRODUCT-005 — Continue reports a pointer but does not continue

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Baseline evidence: `cli/src/build.ts:478` revalidates state and identifies the most recent
  unfinished feature, but `cli/src/build.ts:504` only prints another command. With several
  unfinished features it silently designates the most recent rather than asking or listing a safe
  choice.
- Impact: the promised resume journey adds another manual step and can direct a user to the wrong
  work item.
- Required change: `forge continue` should resume the only unfinished item automatically, display a
  safe selection when several exist, and fail clearly in noninteractive ambiguity. Keep expert
  `forge resume` output compatible.

### FF-PRODUCT-006 — Human output is machine-shaped or audit-report-shaped

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Baseline evidence: `cli/src/cli.ts:807` JSON-stringifies every non-string object even without
  `--json`; install output is therefore a raw action object. `cli/src/report.ts:339` renders the
  full technical Markdown report, including every evidence ledger and finding field, as the normal
  report surface.
- Impact: users cannot quickly answer what happened, whether action is required, and what to do
  next. Machine detail and expert evidence remain valuable but are not progressively disclosed.
- Required change: introduce concise plain-language summaries for simple commands, retain complete
  Markdown/JSON artifacts, and show exact paths plus an explicit command for technical detail.

### FF-PRODUCT-007 — Doctor does not prove a usable installation

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Baseline evidence: the current doctor checks Node, three bundled directories, and a local
  ownership manifest. It does not verify Git, platform discovery paths, installed skill counts,
  generated-copy consistency, CLI availability, update state, project state, report freshness, or a
  representative command. A missing ownership manifest is NOT_VERIFIED while the command exits 0.
- Impact: a user can receive a successful process result without knowing that Forge is not installed
  into the current project or agent.
- Required change: separate package-health, project-install, agent-path, and optional project-state
  checks; provide exact recovery commands; use nonzero status for failed required checks while
  preserving NOT_VERIFIED for genuinely unprovable external discovery.

### FF-PRODUCT-008 — Installation works, but the easiest documented route is still expert-oriented

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Baseline evidence: clean packed and offline installs pass, and the ownership/symlink protections
  are strong. The README still leads with a Git-tag npm installation followed by `forge init all`.
  There is no tested `npx skills` route, no concise ready/version/agents/next-command confirmation,
  and no first-run troubleshooting decision tree.
- Impact: installation has more decisions than necessary and success is difficult to recognize.
- Required change: keep the first-party CLI installer as the deterministic, ownership-manifest path;
  add a tested third-party `npx skills add ... --copy` option where reliable; explain its different
  ownership/update model; print version, installed agent destinations, skill count, and next
  command.

Primary-source caveat: Vercel Labs currently documents `npx skills add` and defaults to symlinks, so
Forge should require its `--copy` mode in the recommended example. Google currently documents
`~/.gemini/config/skills/` for unified Antigravity products, while the third-party CLI advertises a
different Antigravity-specific global path. Forge must not claim those routes are interchangeable;
the first-party installer remains authoritative for Forge's documented Antigravity path.

### FF-PRODUCT-009 — The documentation hierarchy is missing the requested short paths

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Baseline evidence: no `GETTING_STARTED.md`, `BUILD_YOUR_FIRST_APP.md`, `AUDIT_AN_EXISTING_APP.md`,
  `FIX_COMMON_ISSUES.md`, `VERIFY_AND_SHIP.md`, or v0.4 simple-command reference exists. The README
  quick start begins with expert skill names and manual slugs.
- Impact: different user intents—install, build, audit, repair, verify, troubleshoot—are mixed into
  large references instead of short executable journeys.
- Required change: create `GETTING_STARTED.md`, `BUILD_YOUR_FIRST_FEATURE.md`,
  `AUDIT_YOUR_APPLICATION.md`, `FIX_AND_VERIFY.md`, `SHIP_A_RELEASE.md`, `NONTECHNICAL_GUIDE.md`,
  `TROUBLESHOOTING.md`, and `ADVANCED_CLI.md`; keep advanced references, and make the README
  simple-first with progressive links.

### FF-PRODUCT-010 — There is no under-ten-minute onboarding demo or first-run regression suite

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Baseline evidence: the repository has strong flawed-project and Build prevention fixtures, but no
  demo that exercises install → build → audit → fix → verify → ship through the simple layer. CLI
  tests assert expert commands and evidence safety, not guided menu, typo suggestions, natural
  language, installation wording, or first-run recovery.
- Impact: the new user promise could regress while all current checks stay green.
- Required change: add a deterministic, non-networked demo and test matrix for every simple CLI and
  skill command, interactive/noninteractive behavior, clean installs, common mistakes, Windows and
  Unix path behavior, and unchanged expert commands.

## Proven strengths to preserve

- Missing evidence does not become `PASS`; unavailable evidence remains `NOT_VERIFIED` or `BLOCKED`.
- Build evidence cannot satisfy independent Ship gates.
- Project commands require explicit authorization and run as bounded argument vectors without a
  shell.
- Offline policy, redaction, path containment, symlink refusal, ownership manifests, and modified
  file preservation are tested.
- The complete v0.3.0 suite, coverage floors, clean packed install, offline install, deterministic
  generation, and six platform roots pass before product-layer work begins.
- Existing expert commands and report schemas are stable compatibility surfaces and should remain
  available.

## Implementation order established by this report

1. Add a pure, tested simple-command parser, intent/area mapper, safe slugger, suggestion engine,
   compact renderer, and no-argument menu model.
2. Route the new vocabulary into existing Build, Audit, Fix, Verify, and Ship engines without
   duplicating or weakening their evidence logic.
3. Add project status and strengthen doctor with actionable, status-sensitive checks.
4. Generate a `forge` product skill into every platform root through canonical sources only.
5. Add first-run, compatibility, security, installation, and end-to-end tests.
6. Restructure onboarding documentation and add the under-ten-minute demo.
7. Re-run the full check, coverage, package, offline/online clean install, command matrix, and
   release-readiness review before recommending a version.

## Initial limitations

- No real agent application was launched during this initial assessment, so host UI rendering of a
  slash skill is NOT_VERIFIED. The filesystem layouts and skill metadata are directly verified.
- Production provider, browser, database, deployment, registry publication, and human usability
  outcomes are outside this pre-implementation static/CLI baseline.
- The external agent-skill ecosystem is evolving. Platform paths are time-sensitive and must be
  rechecked during final release verification.
