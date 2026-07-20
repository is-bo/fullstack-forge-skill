# Audit classification — v0.1.9

Every reported defect was reproduced against the untouched `7056cbb` baseline, or against the
pre-integration branch head `4d4655a`, before any fix was written. Classification uses `CONFIRMED`,
`PARTIALLY_CONFIRMED`, `NOT_REPRODUCED`, `INVALID`, and `NOT_VERIFIED`.

This release is scoped to the audit orchestration and report-output milestone. It does not claim
coverage of the other open specification areas, which are listed unchanged at the end of this
document.

## Reported defects

| Defect                                                  | Classification | Reproduction                                                                                                                                                                                                                                                     | Resolution                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An audit was silent about everything it did not check   | CONFIRMED      | Against `7056cbb`, `forge <section> audit` inspected files and stopped. Checks that were never attempted left no record, so the report's silence was indistinguishable from a clean result.                                                                      | A deterministic planned-check list is built before anything executes, and every planned check reaches exactly one terminal outcome. Checks that did not run are recorded with an explicit cause and reason.                                 |
| Runtime and command evidence never reached the report   | CONFIRMED      | Against `7056cbb`, project-command and rendered-UI results existed only in separate `forge tool` invocations and never entered `AuditReport`. The v0.1.8 `planned_checks` and `runtime_evidence` ledgers were populated only by direct API callers.              | Orchestration emits facts across an `AuditLedgerSink` boundary, and `ReportAuditLedger` persists them into the v0.1.8 typed ledgers via `cli/src/ledger.ts`, reaching the report through the trailing `ledgers` argument to `createReport`. |
| `--offline` executed arbitrary audited-project commands | CONFIRMED      | Found during integration review of PR #21 and reproduced against branch head `4d4655a`. Planning derived a boolean `network_dependent` flag from keyword scanning alone, so `eslint .`, `vitest run`, and `tsc -p .` all executed under `--offline --allow-run`. | Planned checks now carry a `network_policy` obtained exclusively through `plannedCheckNetworkPolicy`. Keyword scanning may only escalate `UNKNOWN` to `NETWORK_REQUIRED`; nothing may downgrade a command to `OFFLINE_SAFE`.                |
| Runtime evidence was attempted under `--offline`        | CONFIRMED      | Reproduced against `4d4655a`: the offline refusal was scoped to `check.kind === "project-command"`, so a `--url` rendered capture was still attempted offline and, on success, marked the evidence complete.                                                     | The offline gate now applies to every check whose policy is not `OFFLINE_SAFE`. A refused runtime check also marks `evidence_complete` false rather than passing silently.                                                                  |
| Stale report-schema expectations in branch tests        | CONFIRMED      | `cli/tests/report-output.test.ts` and `cli/tests/cli-report-mode.test.ts` asserted `schema_version === 1`. v0.1.8 released schema 2, so both failed on merge.                                                                                                    | Both assertions now read the canonical `REPORT_SCHEMA_VERSION` export rather than a hard-coded literal, so a future bump cannot leave a stale expectation behind.                                                                           |

The offline defect is the reason this integration was reviewed rather than merged directly. It is
the precise hazard that v0.1.8 introduced `plannedCheckNetworkPolicy` to prevent, and this release
is the first one that wires a caller into that vocabulary. Every single-branch test stayed green
while the policy was being weakened, which is why the regression is asserted at the seam.

## Verified non-regressions

All pre-existing tests pass unmodified; the suite moved from 366 recorded at v0.1.8 to 436 here.

The v0.1.7 offline command policy is re-tested directly against the new orchestrator by
`cli/tests/cross-feature-v017-v019.test.ts`: a keyword-free arbitrary project script is still
`UNKNOWN` and still blocked under `--offline`, no definition tested can reach `OFFLINE_SAFE`,
keyword matching escalates but never downgrades, and a blocked check yields no `RUN` status and no
`PASS` finding. `cli/tests/cross-feature-v017-v018.test.ts` continues to pass unchanged.

`cli/src/analyzers.ts` is untouched by this release, so the v0.1.7 structural security proof carries
forward unchanged, including `isModeledAddressGuard` and the rule that a no-op `isPrivate`,
`isLinkLocal`, `isInternal`, or `privateAddress` helper still reports SSRF.

A not-run check remains `NOT_VERIFIED` in findings and `NOT_RUN` in the planned-check ledger, never
`BLOCKED`. `BLOCKED` feeds the `forge fix` candidate set, so mislabelling a merely unauthorized
check would give `forge all fix --safe --allow-run` work that was never blocked. This is asserted
directly in the cross-feature suite.

A default audit remains static-only: with no `--allow-run`, nothing is executed and no runtime
evidence is collected. Rendered evidence integrates only from an application the operator already
started, and browser tooling is never installed automatically.

Report mode does not re-run an audit and does not modify the stored report; report output refuses
traversal, absolute, drive-qualified, UNC, and symlinked destinations, and refuses to overwrite
unowned or externally edited files.

## Deferred specification areas

The following remain open and are not addressed by this release. They are listed so that this
document cannot be read as a completeness claim.

- Discovery evidence classification and specification traceability validation.
- Rendered-state criteria remain `NOT_VERIFIED` wherever no trusted browser driver is available.
- Operating-system network isolation is not implemented and is not claimed. `--offline` blocks
  `UNKNOWN` commands rather than sandboxing them, and the reported sandbox is always `none`.
- Analyzer breadth is bounded by the declared rule set and its declared unsupported shapes.
