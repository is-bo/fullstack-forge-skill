# Audit classification — v0.1.10

Every reported defect was reproduced against the untouched `311d6ab` baseline, or against the
pre-integration branch head `c84e8ea`, before any fix was written. Classification uses `CONFIRMED`,
`PARTIALLY_CONFIRMED`, `NOT_REPRODUCED`, `INVALID`, and `NOT_VERIFIED`.

This release is scoped to the discovery evidence classification and specification traceability
milestone. It does not claim coverage of the other open areas, which are listed at the end of this
document.

## Reported defects

| Defect                                                       | Classification | Reproduction                                                                                                                                                                                                                                                           | Resolution                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Weak signals activated production capabilities               | CONFIRMED      | Against `311d6ab`, a capability keyword appearing only in documentation, a test, a fixture, a generated platform copy, or a comment was sufficient to mark the capability present, so a module could be audited for a capability the project never had.                | Every detection now records an evidence class, path, line, confidence, activation weight, reason, and workspace. Documentation, tests, fixtures, and generated copies carry zero activation weight.    |
| A pile of weak signals produced a false `PRESENT`            | CONFIRMED      | Capability determination was boolean, so any signal at all produced presence and no signal produced absence. Neither outcome could express "not enough evidence to decide".                                                                                            | Determination returns `PRESENT`, `ABSENT`, or `UNKNOWN` against an explicit activation threshold, so weak evidence produces `UNKNOWN` rather than a false `PRESENT` or a false `ABSENT`.               |
| Traceability claims were self-declared and unverifiable      | CONFIRMED      | No published record tied authoritative requirements to implementation, tests, documentation, and release evidence, so compliance claims could not be checked by anyone.                                                                                                | `config/traceability-matrix.json` is the source of truth, `docs/TRACEABILITY_MATRIX.md` is generated from it, and `npm run check:traceability` runs inside `npm run check` and therefore inside CI.    |
| Traceability attributions were wrong                         | CONFIRMED      | Reproduced against branch head `c84e8ea`. Four requirements carried `integration:` placeholders. `FF-MOD-15` attributed the static security analyzer to v0.1.9 and `FF-ORCH-01` attributed the orchestrator to v0.1.7; both were self-declared inference.              | The static security analyzer belongs to v0.1.7 / PR #19 (`cli/src/analyzers.ts` first landed in `c8073ed`), and the orchestrator to v0.1.8 / PR #20 and v0.1.9 / PR #21. All placeholders are removed. |
| An `UNKNOWN` assessment could become a proven `ABSENT`       | CONFIRMED      | Found during integration review of PR #22. Projecting the assessment onto the v0.1.8 decision axis without care reports `UNKNOWN` as `ABSENT`, which `decisionFindingStatus` turns into `NOT_APPLICABLE` — the exact defect v0.1.8 exists to close.                    | The projection never strengthens a claim. `UNKNOWN` stays `UNKNOWN`; across workspaces `PRESENT` wins, and `ABSENT` requires every workspace to prove absence.                                         |
| Unmodelled capabilities would have been disabled permanently | CONFIRMED      | Found during integration review of PR #22 and caught by four pre-existing tests. The evidence layer models sixteen capabilities; module decisions are gated on twenty-four. Reading the resulting silence as `UNKNOWN` disabled every module gated on the other eight. | A capability the evidence layer does not model falls back to the legacy presence map instead of being reported `UNKNOWN` forever. This is asserted directly.                                           |

The last two entries are the reason this integration was reviewed rather than merged directly. Both
were found at the seam between the v0.1.8 module-decision schema and the v0.1.10 evidence layer, and
the second was caught only because pre-existing tests failed.

## Verified non-regressions

All pre-existing tests pass unmodified; the suite moved from 436 recorded at v0.1.9 to 480 here.

`cli/tests/cross-feature-v018-v0110.test.ts` re-tests the v0.1.8 applicability rules directly
against the new evidence layer: an `UNKNOWN` assessment never becomes `ABSENT`, only a proven-absent
capability yields `NOT_APPLICABLE`, absence must be proven in every workspace, one workspace proving
presence is enough for the project, documentation- and test-only signals cannot activate a
capability, and an unmodelled capability still uses the legacy map.

`cli/tests/cross-feature-v017-v018.test.ts` and `cli/tests/cross-feature-v017-v019.test.ts` continue
to pass unchanged, so the v0.1.7 offline command policy and the v0.1.9 orchestration policy carry
forward intact.

`cli/src/analyzers.ts` is untouched by this release, so the v0.1.7 structural security proof carries
forward unchanged, including `isModeledAddressGuard`.

## Release-candidate self-audit

`forge all audit` was run against this release candidate. It reports 48 findings: 2 `FAIL`, 32
`NOT_VERIFIED`, 14 `NOT_APPLICABLE`.

Both `FAIL` findings — `FF-INTEGRATION-DUPLICATE-001` and `FF-SECRET-001` — are located entirely
inside Forge's own analyzer test files. They are the deliberately vulnerable sample sources and
`sentinel-` placeholder strings that those tests write into temporary projects in order to assert
that the analyzers detect exactly these patterns. They are not production defects and contain no
real credential; `npm run scan:secrets` reports zero findings and GitHub secret scanning reports
zero open alerts.

These findings are pre-existing rather than introduced here: released v0.1.9 reports eleven `FAIL`
findings on the same self-audit, and the two remaining at v0.1.10 are a strict subset. The reduction
from eleven to two is the evidence classification working as intended. Neither finding meets the
release-blocking bar, and neither was treated as one.

## Deferred specification areas

The following remain open and are not addressed by this release.

- Rendered-state criteria remain `NOT_VERIFIED` wherever no trusted browser driver is available.
- Operating-system network isolation is not implemented and is not claimed. `--offline` blocks
  `UNKNOWN` commands rather than sandboxing them, and the reported sandbox is always `none`.
- The evidence layer models sixteen capabilities. The other eight capabilities module decisions are
  gated on still use the legacy presence map.
- Analyzer breadth is bounded by the declared rule set and its declared unsupported shapes.
- Two traceability requirements remain `NOT_VERIFIED` with `verification_scope: external`. Both are
  GitHub-hosted repository settings that cannot be proven from repository contents.
