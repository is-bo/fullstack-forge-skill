# Report schema

Schema-v2 project profiles may include an additive `inventory` object. It records `COMPLETE` or
`PARTIAL`, candidate/inspection counts, actual bytes read, excluded classes, user patterns, largest
contributors, affected modules, and suggested actions. Older profiles without this optional field
remain readable. Report environments may similarly record the explicit inspection budget and CLI
exclusions; no report schema version bump is required because both additions are optional and
fail-closed inventory state is represented by the ordinary `NOT_VERIFIED` finding status.

`.forge/report.json` is written at **schema version 2**. Version 1 reports (written by v0.1.3
through v0.1.6) are still readable and are migrated in memory on load.

## Top-level fields

| Field               | Since | Meaning                                                        |
| ------------------- | ----- | -------------------------------------------------------------- |
| `schema_version`    | 1     | `2` for reports written by this release                        |
| `generated_at`      | 1     | UTC timestamp of the run                                       |
| `root`              | 1     | Canonical audited root                                         |
| `revision`          | 1     | Working-tree revision the evidence belongs to                  |
| `scope`             | 1     | `full`, `changed`, `applicable`, or a module name              |
| `profile`           | 1     | Discovery profile                                              |
| `findings`          | 1     | Deduplicated, severity-sorted findings                         |
| `execution`         | 1     | Commands actually executed, with exit code and timing          |
| `assumptions`       | 1     | Stated assumptions                                             |
| `residual_risk`     | 1     | Risk the run did not retire                                    |
| `scope_evidence`    | 1     | Changed-scope base, merge base, and per-file inclusion reasons |
| `environment`       | 1     | Machine and mode that produced the report                      |
| `gate_evidence`     | 1     | Semantically typed evidence consumed by release gates          |
| `analyzer_coverage` | 1     | Analyzer reach and missing adapters                            |
| `tools`             | 2     | Provenance of every tool the report relies on                  |
| `planned_checks`    | 2     | Checks the run intended to perform, and the outcome of each    |
| `runtime_evidence`  | 2     | Evidence gathered by observing the running system              |
| `module_decisions`  | 2     | Why each module was or was not audited                         |
| `migration`         | 2     | Present only when the report was read from an older schema     |

## Gate evidence envelopes

The report schema remains version 2, but v0.3 gate-evidence records may carry an optional verified
`envelope`. This is an additive field. Older records remain readable and visible after in-memory
migration, but Ship treats a record without a current verified envelope as historical diagnostics.

An envelope records domain (`Audit` or `Ship` for report evidence), registered producer and version,
contract, canonical root, revision, exact evidence type/criterion and status, run ID, production and
expiry timestamps, environment, limitations, instance IDs, outer-claim digest, and a non-empty
one-to-one `(path, SHA-256, media type)` artifact list. Registered Ship command evidence also binds
command name, argv, detected definition, exit code, start time, duration, output digest, and input
manifest. Unknown envelope fields are rejected.

Ship re-hashes every envelope artifact against the selected root and current revision when it
consumes the record. A legacy, expired, cross-root, cross-revision, unregistered, changed,
malformed, or Build-domain envelope cannot satisfy a Ship gate. The envelope proves local contract
and artifact integrity; it does not make a bounded analyzer or command a whole-program or external
attestation.

## Module applicability

Applicability is two independent axes. Collapsing them is the defect this structure exists to
prevent: a module skipped because its files did not change is **unaudited**, not **inapplicable**.

```ts
type ModuleDecision = {
  module: string;
  capability_status: "PRESENT" | "ABSENT" | "UNKNOWN";
  selection_status: "SELECTED" | "OUT_OF_CHANGED_SCOPE" | "EXCLUDED_BY_RISK" | "NOT_REQUESTED";
  reasons: string[];
  evidence: string[];
  explicitly_selected?: boolean;
};
```

- `capability_status` answers _does this capability exist?_ It is the only axis that may justify
  `NOT_APPLICABLE`.
  - `PRESENT` — discovery detected the capability, or the module is always applicable.
  - `ABSENT` — discovery observed capabilities and this one was not among them.
  - `UNKNOWN` — discovery recorded no capability signals at all, so absence is unproven.
- `selection_status` answers _did this run audit it?_ It never proves anything about the code.

The resulting finding status is derived, never asserted directly:

| Capability          | Selection              | Finding status    |
| ------------------- | ---------------------- | ----------------- |
| any                 | `SELECTED`             | module is audited |
| `ABSENT`            | not selected           | `NOT_APPLICABLE`  |
| `PRESENT`/`UNKNOWN` | `OUT_OF_CHANGED_SCOPE` | `NOT_VERIFIED`    |
| `PRESENT`/`UNKNOWN` | `EXCLUDED_BY_RISK`     | `NOT_VERIFIED`    |
| `PRESENT`/`UNKNOWN` | `NOT_REQUESTED`        | `NOT_VERIFIED`    |

Ship gates read the same records. A capability gate is dismissed as `NOT_APPLICABLE` only when the
capability is proven absent; if the prior report says the module exists but was skipped, the gate
stays required and unverified, so narrowing an audit can never switch a release gate off.

## Planned checks

```ts
type PlannedCheck = {
  check_id: string;
  module: string;
  command?: string[];
  source: string;
  status: "RUN" | "NOT_RUN" | "BLOCKED" | "NOT_APPLICABLE";
  reason?: string;
  requires_authorization: boolean;
  network_policy: "OFFLINE_SAFE" | "NETWORK_REQUIRED" | "UNKNOWN";
};
```

Planning is recorded before execution so a check that never ran is visible as a gap instead of
silently missing. Any status other than `RUN` requires a `reason`.

## Runtime evidence

```ts
type RuntimeEvidence = {
  evidence_id: string;
  evidence_type: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_VERIFIED";
  revision: string;
  artifact_paths: string[];
  hashes: string[];
  limitations: string[];
};
```

`artifact_paths` must be safe repository-relative paths; `hashes` must be lowercase SHA-256 digests
(optionally `sha256:`-prefixed). Any non-`PASS` status requires at least one limitation, because a
partial capture that states no limitation reads exactly like a clean result.

## Tool records

```ts
type ToolRecord = {
  tool_id: string;
  name: string;
  ownership: "forge-owned" | "project-owned" | "external";
  trust: "trusted" | "untrusted" | "unknown";
  version: string;
  version_source: "observed" | "declared" | "unknown";
  invocation?: string[];
  limitations: string[];
};
```

A version that could not be observed records `version: "unknown"` with `version_source: "unknown"`
rather than a plausible guess. Any tool that is not `trusted` must record at least one limitation.

## Migration

`readReport` accepts schema 1 and schema 2 and returns the current schema. Migration is **in memory
only** — the file on disk is never rewritten, so reading an old report cannot destroy the original
evidence. A caller that genuinely wants to rewrite it must pass the migrated value to `writeReport`.

Migration never fabricates absent data:

- findings, execution records, assumptions, residual risk, and typed gate evidence are preserved
  verbatim;
- report identity (`generated_at`, `root`, `revision`, `scope`) is preserved rather than
  regenerated;
- every ledger the source lacked stays empty and is named in `migration.absent_ledgers`; and
- `migration.notes` states explicitly that an empty ledger reflects a release that did not track it,
  and is not evidence that the corresponding checks ran or passed.

`migration.detected_origin` classifies the writing release from the fields the report carries
(instance identity, typed evidence, environment record). It is labelled as an inference because no
release before v0.1.6 recorded its own version in the report.

Reports whose `schema_version` is newer than 2 are refused rather than misread.

## Ledger APIs

`cli/src/ledger.ts` exposes the append-only builders used to assemble these ledgers:
`createPlannedCheck`, `appendPlannedCheck`, `recordExecutedCheck`, `recordBlockedCheck`,
`appendRuntimeEvidence`, `appendModuleDecision`, and `appendToolRecord`.

Every function is pure: it validates its input, returns a new array, and never mutates the ledger it
was given. Entries deduplicate by stable ID and keep first-append order, so a report rendered twice
from the same ledger is byte-identical.

The central invariant is that **honesty only ever decreases**. A check recorded `BLOCKED` or
`NOT_RUN` can never be rewritten as `RUN`, and runtime evidence recorded `BLOCKED` or `NOT_VERIFIED`
can never be rewritten as `PASS`. Re-recording a weaker outcome is permitted, because discovering
that a result was less certain than believed is a legitimate correction; the reverse is not, because
the stronger claim was never observed.
