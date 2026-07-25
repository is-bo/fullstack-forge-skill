# Fullstack Forge v0.5 product-polish gap report

- Status: initial pre-implementation assessment
- Assessment date: 2026-07-25
- Baseline: Fullstack Forge v0.4.0, commit `afec5d8d238a7672a12e322fe9817eb881d088f9`

## Executive finding

Fullstack Forge v0.4.0 already provides the requested simple product entrance, guided CLI,
plain-language feature framing, concise reports, short guides, and a deterministic onboarding demo.
The Build and Audit engines remain separate from the product layer and retain their evidence,
approval, and release-independence contracts.

The product is usable, but the assessment found two direct behavior contradictions and several
unverified resilience or onboarding claims. The most important defects are:

1. the documented `forge audit uploads and file storage` example is rejected as ambiguous;
2. `forge verify` can return exit code `0` while its resulting finding is `NOT_VERIFIED`;
3. Verify can rebind unchanged positive findings from a stale report to a new revision without
   rechecking them;
4. installation has no crash journal, so an interruption before the ownership manifest is written
   can leave files that a retry no longer owns;
5. `forge doctor` does not check update availability; and
6. v0.4 product-layer requirements are absent from the public traceability matrix.

Broad UX changes should wait until the evidence-exit and installer-ownership defects are fixed.

## Inspection scope and baseline evidence

The assessment covered the tracked repository inventory, private source-of-truth product
specification and vision material, canonical and generated skills, CLI source and compiled output,
install/update/uninstall code, platform targets, command aliases, package and release policy,
workflows, tests, evaluations, reports, documentation, the demo, and current Build/Audit journeys.
Repository and external content were treated as untrusted data.

| Evidence                        | Baseline result                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Public v0.4.0 release           | Immutable release, 13 expected assets, provenance verification, and clean public-tag installation passed |
| Focused product/installer suite | 22 passed, 0 failed                                                                                      |
| Canonical/generated consistency | 106 canonical files match all 6 generated platform roots                                                 |
| Skill validation                | 46 canonical skills and all 6 generated roots passed                                                     |
| Traceability validation         | 81 valid entries: 43 compliant, 36 partially compliant, 2 externally not verified                        |
| Install-document validation     | 75 Markdown files passed pinned-install checks                                                           |
| Dry-run project discovery       | Exit 0, no report files written, 26 detection records                                                    |
| Composite audit-area probe      | Exit 1: `uploads and file storage` is reported as ambiguous                                              |
| Current source inspection       | Verify returns 0 after FAIL/BLOCKED checks even when findings remain NOT_VERIFIED                        |
| Working tree before changes     | Clean, on `main`, equal to `origin/main`                                                                 |

The v0.4.0 release gate also passed the complete check, coverage, package, packed-install, offline
install, checksum, release-asset, and clean public-tag install flows. Those results are release
evidence for the baseline; they do not substitute for the missing cases below.

## Prioritized findings

### FF-PRODUCT-101 — A documented natural-language audit request is rejected

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Evidence: `resolveAuditArea()` accumulates both `uploads` and `storage` for
  `uploads and file storage` and deliberately throws. The unit test asserts the rejection, while
  `docs/AUDIT_YOUR_APPLICATION.md` and the product requirement present the phrase as a working
  example. A direct compiled-CLI probe exits 1 with `Choose one: storage, uploads`.
- Impact: a first-time user following the documentation encounters an error. The behavior also
  contradicts the promise that ordinary-language areas map to the appropriate disciplines.
- Required change: support an explicit, bounded multi-discipline route for composite requests.
  Continue rejecting genuinely uncertain phrases and show the exact selected disciplines.

### FF-PRODUCT-102 — Verify can report process success with unverified results

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Evidence: `verifyFindings()` correctly produces `NOT_VERIFIED` for manual steps, unavailable
  analyzers, dry runs, and disappearance without behavioral proof. `verifySection()` returns 1 for
  `FAIL`, 2 for `BLOCKED`, and otherwise 0; it does not inspect `NOT_VERIFIED`.
- Impact: automation and ordinary users can interpret exit 0 as successful verification even when
  the requested evidence was not obtained. This contradicts the evidence contract and documented
  exit-code semantics.
- Required change: return exit 2 when a current verification result contains `NOT_VERIFIED`, while
  retaining precedence 1 for a proven failure and 2 for blocked/incomplete evidence.

### FF-PRODUCT-103 — Interrupted installation ownership is not recoverable

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / NOT_VERIFIED
- Evidence: `install()` preflights conflicts, writes managed files sequentially, then writes
  `.fullstack-forge/install-manifest.json`. No install transaction or crash journal is written
  before those files. A retry treats identical files left before the manifest as pre-existing and
  records them `owned: false`; uninstall will then preserve them. Existing tests cover ordinary
  lifecycle, conflict preflight, modification, traversal, and symlinks, but not interruption.
- Impact: a killed process can leave hundreds of files whose ownership cannot be safely inferred or
  repaired, even though a later install appears successful.
- Required change: add a path-contained, symlink-free, hash-bound crash transaction, either through
  a journal or ownership-first atomic manifest updates, with deterministic resume/repair behavior.
  Never adopt unrelated identical files without transaction evidence, and add interruption tests at
  multiple write boundaries.

### FF-PRODUCT-113 — Verify can rebind stale positive findings without rechecking them

- Priority: P0
- Severity / confidence / status: HIGH / HIGH / FAIL
- Evidence: `verifyFindings()` writes a new report bound to the current working-tree revision. When
  the prior revision differs, a selected `PASS` or `NOT_APPLICABLE` finding with no executable
  verification plan is copied unchanged; findings outside a section-specific Verify are also copied
  unchanged. Their old evidence is therefore presented inside a current-revision report.
- Impact: a repository change can invalidate earlier positive evidence while the new report appears
  revision-bound and successful.
- Required change: compare the previous and current revisions, demote every stale finding that was
  not directly rechecked to `NOT_VERIFIED`, preserve its old status as a diagnostic, and make the
  incomplete result exit 2.

### FF-PRODUCT-104 — Doctor omits update availability

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Evidence: Doctor checks Node, Git, selected bundle files, catalog count, ownership manifest,
  installed integrity, destinations, repository state, project commands, optional Playwright, Build
  state, and report freshness. It performs no current-release comparison.
- Impact: the command does not satisfy its documented role as the single installation health check,
  and users receive no actionable notice when a newer Forge release exists.
- Required change: perform a bounded check against the fixed upstream tag source, honor offline
  mode, parse remote output as untrusted data, and report unavailable evidence honestly with an
  exact retry/update command.

### FF-PRODUCT-105 — Installation success does not present the promised first choices

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / PARTIALLY_COMPLIANT
- Evidence: successful installation prints version, scope, selector, agent names, skill count, file
  count, and `run 'forge doctor', then 'forge help'`. It does not show the promised Build, Audit,
  and Help entry points.
- Impact: installation succeeds technically but still makes a new user discover the first useful
  command.
- Required change: keep the diagnostic next step and add compact Build, Audit, and Help examples in
  the success message and its tests.

### FF-PRODUCT-106 — No supported-agent recommendation is produced

- Priority: P1
- Severity / confidence / status: MEDIUM / MEDIUM / PARTIALLY_COMPLIANT
- Evidence: an omitted selector defaults to `all`; installation confirms written destinations but
  does not inspect existing agent configuration or recommend a narrower target.
- Impact: `all` is reliable but writes six platform copies when a user may only need one, and the
  requested detect/recommend experience is absent.
- Required change: add a read-only, deterministic detector for known project paths and executable
  hints. Preserve `all` as the compatibility default, label recommendations as evidence-based, and
  avoid claiming that a host application is installed merely because a directory exists.

### FF-PRODUCT-107 — Product-layer requirements are missing from traceability

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / FAIL
- Evidence: the authoritative matrix contains 81 Audit, Build, installation, security, and release
  requirements but no entries for the simple command layer, guided mode, nontechnical rendering,
  status/doctor onboarding, or the demo.
- Impact: the release can validate an internally consistent matrix while omitting the newest public
  product promises.
- Required change: add independently worded product requirements with implementation, test,
  documentation, release-evidence, and limitation links, then regenerate the published matrix.

### FF-PRODUCT-108 — The demo test stops before the release gate

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / PARTIALLY_COMPLIANT
- Evidence: the quickstart CLI test proves Audit → fix preview → safe fix → Verify. The documented
  journey includes Ship, but no demo assertion runs Ship or verifies an honest blocked/not-ready
  result.
- Impact: a regression in the final onboarding step can pass every demo-specific test.
- Required change: execute Ship in the demo test and assert the documented fail-closed outcome and
  next action.

### FF-PRODUCT-109 — Previous-release upgrade is assumed, not exercised

- Priority: P1
- Severity / confidence / status: MEDIUM / HIGH / NOT_VERIFIED
- Evidence: installer tests exercise a same-version reinstall/update. The v0.4 release clean-room
  evidence starts from an empty target. No automated test installs the previous public release and
  upgrades its ownership manifest with the current candidate.
- Impact: compatibility failures in real upgrades may be missed.
- Required change: add a deterministic previous-manifest fixture for unit coverage and run a
  clean-room v0.4.0 → candidate upgrade during final validation.

### FF-PRODUCT-110 — Host-level slash invocation and slash-command typos remain external

- Priority: P2
- Severity / confidence / status: LOW / HIGH / NOT_VERIFIED
- Evidence: CLI typo suggestions cover `autdit`, `biuld`, and `contnue`; generated skill metadata is
  structurally validated. `/froge` and `/forget` are rejected by the host before the Forge router is
  selected on platforms that resolve slash names exactly. No real Codex, Claude, Cursor, Gemini,
  Antigravity, Windsurf, or Copilot UI was launched in the baseline assessment.
- Impact: Forge cannot guarantee recovery text for an input it never receives.
- Required change: test every typo that reaches the CLI, document the host boundary, and avoid
  claiming host-rendered slash behavior without direct host evidence.

### FF-PRODUCT-111 — Two public Markdown tables contain unescaped command alternatives

- Priority: P2
- Severity / confidence / status: LOW / HIGH / FAIL
- Evidence: README and the product-layer design place literal `|` characters inside table cells for
  command alternatives, which CommonMark interprets as extra columns.
- Impact: the most visible command mapping can render incorrectly.
- Required change: escape cell pipes or replace them with prose, then run link/format checks.

### FF-PRODUCT-112 — Runtime support is structural for most agent hosts

- Priority: P2
- Severity / confidence / status: LOW / HIGH / NOT_VERIFIED
- Evidence: generated roots, ownership manifests, destination paths, packages, and no-link behavior
  are directly tested. Only the CLI and filesystem contracts run in automation; vendor agent
  applications are not launched.
- Impact: support claims must distinguish generated-format compatibility from host-UI execution.
- Required change: retain the explicit limitation in the platform matrix and record manual host
  checks only when they are actually performed.

## Proven strengths to preserve

- The simple router orchestrates existing Build, Audit, Fix, Verify, and Ship engines instead of
  duplicating them.
- Build evidence cannot approve Ship, and Ship re-derives candidate evidence independently.
- Missing or unavailable runtime evidence remains `NOT_VERIFIED` or `BLOCKED`.
- Project commands require explicit authorization and run as argument vectors without a shell.
- Safe fixes are previewed by default and remain structurally bounded.
- Install preflight refuses unowned conflicts and symlinked destinations; uninstall preserves
  modified files.
- Canonical and generated skill copies are deterministic and ownership-manifest driven.
- Expert commands, report schema v2, Build schema v2, and advanced JSON/detail output remain
  available.
- The public v0.4.0 release, archives, checksums, provenance, and clean install are directly
  verified.

## Implementation order

1. Correct Verify exit semantics and add regression coverage.
2. Add an explicit multi-discipline natural-language route without weakening ambiguity handling.
3. Make installation resumable through a validated transaction journal and test interrupted runs.
4. Add bounded update checking, install onboarding, and supported-agent recommendations.
5. Extend traceability and the demo release-gate test.
6. Correct documentation rendering and state the host-execution limits precisely.
7. Run the complete suite, clean installations, previous-version upgrade, command matrix, package
   validation, security review, and independent release gate.

## Initial limitations

- This is the required pre-implementation report. Findings are not marked resolved until the final
  implementation and validation evidence exists.
- Platform documentation was recently verified from primary sources, but host application UI
  execution remains external and time-sensitive.
- Provider, production, browser, assistive-technology, and remote deployment outcomes remain
  environment-dependent and must not be inferred from static structure.
