# Audit classification — v0.1.7

Every reported defect was reproduced against the untouched `46b46cf` baseline before any fix was
written. Classification uses `CONFIRMED`, `PARTIALLY_CONFIRMED`, `NOT_REPRODUCED`, `INVALID`, and
`NOT_VERIFIED`.

This release is scoped to the offline command policy and structural security proof milestone. It
does not claim coverage of the other open specification areas, which are listed unchanged at the end
of this document.

## Reported defects

| Defect                                                | Classification | Reproduction against `46b46cf`                                                                                                                                                                                                                                                                         | Resolution                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--offline` ignored outside the rendered-UI driver    | CONFIRMED      | `forge tool run-project-command` and every `forge ship` gate spawned the audited project's own scripts with unrestricted network access while the report recorded `offline: true`. The flag was consumed only by the rendered-UI path.                                                                 | New `cli/src/offline-policy.ts` classifies every command from its definition and every execution path consults it. `UNKNOWN` commands are blocked offline. `sandbox` is always reported as `none` because no operating-system isolation exists in this codebase.                          |
| Generic name-based security proof                     | CONFIRMED      | Protection was granted from a callee's name across SQL, shell, SSRF, redirect, mass-assignment, upload, and AI sinks. A no-op function named `validate`, `sanitize`, `trusted`, or `safe` silenced the analyzer at every sink.                                                                         | Protection is recognized only from bounded structural evidence: supported library APIs, schema operations attached to the exact value, dominating guards whose deny branch terminates, specification-defined sink encoding, parameterized calls, and same-file helpers actually analyzed. |
| Destination-map proof accepted mutable, internal maps | CONFIRMED      | A `const` object of URL strings suppressed SSRF. `http://127.0.0.1:3000/` and `http://169.254.169.254/latest/meta-data/` are fixed literals, and `const` prevents neither `MAP.key = req.query.url` nor `mutate(MAP)`.                                                                                 | Suppression now requires fixed literal destinations, demonstrable immutability, no property write or delete, no alias escape, no export or return, no pass to an unmodelled function, direct flow to the sink, an explicit redirect constraint, and address classification of literals.   |
| SSRF address guards still credited by name            | CONFIRMED      | Found during integration review of PR #19, not in the original report. `isNetworkConstrainedTarget` matched `/(?:isPrivate\|isLinkLocal\|isInternal\|privateAddress\|linkLocal)/` against the callee name, so `function isPrivate(v) { return false; }` suppressed the finding while blocking nothing. | A guard is credited only when a same-file implementation is analyzed: it must accept the value under test, reference it, and decide against concrete loopback, private, or link-local address evidence. Constant-returning bodies and unmodeled imports are not credited.                 |

## Verified non-regressions

All pre-existing tests pass unmodified; the suite moved from 281 recorded at v0.1.6 to 322 here. A
positive regression test asserts that a genuine structurally proven address guard still suppresses
SSRF, so the name-proof removal is not a wholesale disablement of guard recognition. The v0.1.5 and
v0.1.6 trust boundaries were re-checked and remain in force: audited-project browser drivers are not
imported without `--allow-run`; real-path containment still rejects symlinked and redirected
packages; `--dry-run` resolves, imports, and launches nothing; rendered evidence remains isolated
per revision, run, and route and is redacted before it is written. Report loading and migration for
v0.1.3 through v0.1.6 are untouched, and historical tags remain unchanged.

## Genuine limitations of this release

These are honest boundaries of the implemented model, not deferred work.

| Limitation                                  | Status       | Reason                                                                                                                                                                    |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Address guards imported from another module | NOT_VERIFIED | The implementation is not read, so it cannot be proven to block anything. The mitigation is reported as unverified and the SSRF finding is raised rather than suppressed. |
| DNS resolution of hostname destinations     | NOT_VERIFIED | No resolution is performed, so DNS rebinding and private A records stay outside the proof. Hostname destinations are recorded as DNS-dependent.                           |
| Operating-system network isolation          | NOT_VERIFIED | No namespace, seccomp, firewall, or container boundary exists in this codebase. Offline enforcement is a decision about whether to spawn a command, not a sandbox.        |

## Explicitly not addressed in this release

These are open product gaps carried forward unchanged from v0.1.6, not defects introduced here. They
are recorded so the release does not imply coverage it lacks.

| Area                                                             | Status              | Reason                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changed-scope exclusions labelled `NOT_APPLICABLE`               | NOT_VERIFIED        | Distinguishing "capability absent" from "capability not selected" requires a new machine-readable applicability structure across schema, renderers, and gates. |
| CLI audit orchestration of approved checks and rendered evidence | NOT_VERIFIED        | Integrating runtime evidence into normal audit commands is a feature addition beyond this milestone.                                                           |
| Full `planned_checks` / `runtime_evidence` report ledger         | PARTIALLY_CONFIRMED | The `environment` ledger landed in v0.1.5 and the command ledger lands here; the planned-check and runtime-evidence ledgers did not.                           |
| Report-mode `--output` / `--json` contract                       | NOT_VERIFIED        | Report mode still renders to stdout only; the output-directory contract is unimplemented.                                                                      |
| Discovery evidence classes and activation weights                | NOT_VERIFIED        | Detection still lacks per-signal evidence classes, so documentation-only and test-only signals are not yet weighted apart.                                     |
| Full specification traceability matrix                           | NOT_VERIFIED        | Not produced in this release; the milestone was scoped to the offline and security-proof areas.                                                                |
