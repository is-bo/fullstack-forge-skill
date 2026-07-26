# Finding schema

The authoritative JSON Schema is `src/fullstack-forge/schemas/finding.schema.json`. The report that
contains these findings is described in [report schema](REPORT_SCHEMA.md).

| Field            | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `id`             | Stable `FF-<MODULE>-<NNN>` identifier                                     |
| `instance_id`    | Stable structural identity for one occurrence of a rule                   |
| `section`        | Command module that owns the cause                                        |
| `title`          | Concise, causal summary                                                   |
| `severity`       | Potential impact: CRITICAL, HIGH, MEDIUM, LOW, INFO                       |
| `confidence`     | Evidence quality: HIGH, MEDIUM, LOW                                       |
| `status`         | PASS, FAIL, WARNING, NOT_APPLICABLE, NOT_VERIFIED, BLOCKED, SUPERSEDED    |
| `location`       | Repository-relative paths and optional 1-based lines                      |
| `evidence`       | Reproducible observations; at least one is required                       |
| `impact`         | Concrete harm or audit consequence                                        |
| `recommendation` | Smallest appropriate remediation or next evidence step                    |
| `safe_fix`       | Whether an automatic fix is classified safe—not authorization to apply it |
| `verification`   | Exact checks that can close or confirm the finding                        |
| `standards`      | Relevant versioned criteria; never a compliance claim                     |

Supported `producer` values are `forge-analyzer`, `forge-command`, `agent-reviewed-source`,
`agent-rendered-review`, `agent-runtime-verification`, `external-tool`, and `human-decision`.

Agent-authored findings also require `module`, `producer`, `evidence_type`, `explanation`,
`safe_fix_classification`, `revision`, `commands_executed`, and `remaining_limitations`. Every
source location includes a 1-based line, and source-review findings require an `evidence_snapshot`
with the reviewed file hash. `safe_fix_classification` must agree with `safe_fix`.
`agent-rendered-review` requires evidence type `rendered-review` and at least one structured
`rendered_evidence` record with its kind and observation; artifact path, URL, viewport, state, and
input method are recorded when available. It must not be used for source-only inference.

Analyzer findings may additionally contain:

- `analyzer_id`: the stable named analyzer that produced the finding;
- `trace`: source, sink, and trace-quality details used to assign confidence;
- `evidence_snapshot`: the audited file hash and evidence excerpt used to reject stale fixes; and
- `verification_plan`: analyzer, structural check, targeted command, fixture regression, or manual
  actions that must be evaluated independently; and
- `fix_attempts`: instance-specific planned, applied, blocked, or rolled-back remediation evidence.

Analyzer verification actions carry `instance_id` and repository-relative `scope_paths` when the
source report provides them. Legacy development-preview reports without those fields remain
readable, but new reports and every fix/rollback update prefer exact instance identity over the
rule-level fallback.

Severity and confidence are independent. A critical low-confidence signal remains critical pending
triage. Verification appends evidence and preserves the original identifier, observation, and
evidence snapshot. A pattern that disappears without behavior-level proof remains `NOT_VERIFIED`.

A `PASS` requires affirmative evidence: direct code/configuration with location, a successful
automated check, inspected running behavior, a behavior-demonstrating test, or verified
configuration output. Missing evidence is `NOT_VERIFIED`; demonstrated non-applicability is
`NOT_APPLICABLE`.

At ingestion, each agent finding is bound to the current content revision as `EXACT`, `EXACT_DIRTY`,
`REBASED`, or `STALE`. A stale source snapshot is demoted to `NOT_VERIFIED`; invalid revisions or
hashes are rejected. Stronger bound evidence can mark a contradictory earlier applicability record
`SUPERSEDED`. The earlier record remains historical and links to the active finding through
`superseded_by`, `supersedes`, and `retraction_reason`.
