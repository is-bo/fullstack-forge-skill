# Audit classification — v0.1.8

Every reported defect was reproduced against the untouched `bb35a11` baseline before any fix was
written. Classification uses `CONFIRMED`, `PARTIALLY_CONFIRMED`, `NOT_REPRODUCED`, `INVALID`, and
`NOT_VERIFIED`.

This release is scoped to the module applicability and report evidence ledger milestone. It does not
claim coverage of the other open specification areas, which are listed unchanged at the end of this
document.

## Reported defects

| Defect                                                        | Classification      | Reproduction against `bb35a11`                                                                                                                                                                                                                                                                                                                                               | Resolution                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_APPLICABLE` conflated "no capability" with "not audited" | CONFIRMED           | A module left out of the changed scope, filtered out by `--risk`, or whose capability could not be determined was reported `NOT_APPLICABLE`, which reads as a positive claim that the capability does not exist.                                                                                                                                                             | Applicability is split into two independent axes. `capability_status` records whether the capability exists; `selection_status` records whether this run audited it. `NOT_APPLICABLE` is now reserved for a capability proven absent.           |
| Risk-filtered modules vanished from the report                | CONFIRMED           | `forge all audit --risk high` omitted every non-high-risk module entirely. The report carried no record that those modules had gone unaudited, so absence was indistinguishable from a clean result.                                                                                                                                                                         | Excluded modules now appear with status `NOT_VERIFIED` and an `EXCLUDED_BY_RISK` module decision. This is a deliberate user-visible output change, recorded in the changelog and release notes.                                                 |
| Narrowing an audit could switch a release gate off            | CONFIRMED           | A capability ship gate was dismissed as `NOT_APPLICABLE` when the prior audit showed the module existed but had not been audited, so reducing audit scope silently disabled a gate.                                                                                                                                                                                          | Capability gates now read the capability axis rather than the selection axis, so an unaudited-but-present module leaves its gate active.                                                                                                        |
| Legacy reports could not express untracked ledgers            | CONFIRMED           | Schema 1 reports had no place to record tools, planned checks, runtime evidence, or module decisions, and nothing distinguished "this ledger was empty" from "this release never tracked this ledger".                                                                                                                                                                       | Schema 2 adds the four ledgers. Migration fills absent ledgers with empty arrays and attaches an explicit note that emptiness reflects untracked data and is not evidence the checks ran or passed. The source file is never rewritten.         |
| Report migration claimed false precision about v0.1.7         | CONFIRMED           | Found during integration review of PR #20, not in the original report. `classifyLegacyOrigin` labelled any report carrying an environment record "inferred v0.1.6-compatible". v0.1.7 altered no report field, so v0.1.7 reports were mislabelled.                                                                                                                           | The classification now names both releases and states that they are not distinguishable from a report alone. Asserting v0.1.6 specifically would have been fabricated precision.                                                                |
| Report vocabulary could launder an unproven offline claim     | PARTIALLY_CONFIRMED | Found during integration review of PR #20. v0.1.8 introduces a second network-policy vocabulary (`OFFLINE_SAFE` / `NETWORK_REQUIRED` / `UNKNOWN`) for `PlannedCheck`. No production code assigned it yet, so no live defect was reproducible, but the type permitted a caller to describe an arbitrary audited-project command as `OFFLINE_SAFE`, undoing the v0.1.7 policy. | `plannedCheckNetworkPolicy` is now the only sanctioned bridge between the vocabularies. It maps the two structurally provable exemptions to `OFFLINE_SAFE` and always leaves `UNKNOWN` as `UNKNOWN`. There is no inverse and no promotion path. |

The last entry is classified `PARTIALLY_CONFIRMED` rather than `CONFIRMED` because it was a latent
type-level hazard, not an observable behaviour: no code path assigned the weaker value at the time
it was found. It is recorded because the wiring that would have exercised it is the explicit subject
of the next milestone.

## Verified non-regressions

All pre-existing tests pass unmodified; the suite moved from 322 recorded at v0.1.7 to 366 here. The
v0.1.7 offline command policy and structural security proof are re-tested directly at the seam by
`cli/tests/cross-feature-v017-v018.test.ts`: a keyword-free arbitrary project script is still
`UNKNOWN` and still blocked under `--offline`, a script named `verify:offline` is still classified
from its definition rather than its name, an `UNKNOWN` command reaches the planned-check ledger as
`UNKNOWN`, a blocked command carries no exit code and cannot become `PASS` runtime evidence, and a
blocked check cannot later be re-recorded as `RUN`.

`cli/src/analyzers.ts` is untouched by this release, so the v0.1.7 structural security proof carries
forward unchanged, including the rule that a no-op `isPrivate`, `isLinkLocal`, `isInternal`, or
`privateAddress` helper still reports SSRF.

A not-run check remains `NOT_VERIFIED` rather than `BLOCKED`. `BLOCKED` feeds the `forge fix`
candidate set, so mislabelling a merely unexecuted check would give
`forge all fix --safe --allow-run` work that was never blocked. This is asserted directly in the
cross-feature suite.

Report loading and migration for v0.1.3 through v0.1.7 are covered, and historical tags remain
unchanged.

## Deferred specification areas

The following remain open and are not addressed by this release. They are listed so that this
document cannot be read as a completeness claim.

- Audit orchestration: planned checks, execution, blocked checks, and runtime evidence are not yet
  connected to the report schema by the audit itself. The schema provides the slots; the wiring is
  the subject of the next milestone. Until then the `planned_checks` and `runtime_evidence` ledgers
  are populated only by direct API callers, and the v0.1.7 command ledger still surfaces in ship
  results and tool output rather than in `AuditReport`.
- Discovery evidence classification and specification traceability.
- Rendered-state criteria remain `NOT_VERIFIED` wherever no trusted browser driver is available.
- Operating-system network isolation is not implemented and is not claimed. `--offline` blocks
  `UNKNOWN` commands rather than sandboxing them.
