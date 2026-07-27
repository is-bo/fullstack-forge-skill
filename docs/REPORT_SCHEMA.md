# Report schema

The official outputs are `.forge/report.json` and `.forge/report.md`. They must contain the same
findings, verification state, and limitations, and the final agent response must not contradict
them.

## Severity is potential impact, not a verdict

`severity` records what would happen if the finding is real; `status` records whether it was proven.
The two are independent, so an analyzer may correctly report CRITICAL severity with LOW confidence
and `NOT_VERIFIED` status when it can see the risk but not the control.

Because of that, **no summary may bucket findings by severity alone**. A severity total that spans
statuses counts unproven possibilities as confirmed defects. Both outputs therefore carry a derived
`summary` that separates verdict classes before reporting severity:

| Class            | Statuses                | Meaning                                            |
| ---------------- | ----------------------- | -------------------------------------------------- |
| `confirmed`      | `FAIL`, `WARNING`       | a defect was demonstrated; the only defect count    |
| `evidence_gap`   | `NOT_VERIFIED`, `BLOCKED` | potential impact recorded, verdict not established |
| `passed`         | `PASS`                  | checked and clean                                   |
| `not_applicable` | `NOT_APPLICABLE`        | outside the audited capability                      |
| `superseded`     | `SUPERSEDED`            | retracted history, not an active verdict            |

`summary` is always recomputed from `findings`, never authored, and there is deliberately no
top-level `by_severity` field. `confirmed_critical` and `confirmed_high` exclude every
`NOT_VERIFIED` and `BLOCKED` finding; `unverified_critical_or_high` reports those separately.

This is presentation only. An unverified critical finding still blocks a release through the Ship
open-findings gate exactly as before — separating the counts never relaxes a gate, and missing
evidence never becomes `PASS`.

## Producers

```text
forge-analyzer
forge-command
agent-reviewed-source
agent-rendered-review
agent-runtime-verification
external-tool
human-decision
```

Legacy analyzer findings remain readable. New agent findings must contain:

- stable `id`, `module`, severity, confidence, and status;
- a supported `producer` and `evidence_type`;
- repository-relative source locations with 1-based lines;
- evidence, explanation, impact, recommendation, and standards;
- `safe_fix` plus `safe_fix_classification` (`safe`, `approval-required`, or `unsupported`);
- verification procedure and revision;
- a content hash snapshot for source-review evidence;
- commands executed with exit codes;
- remaining limitations.

Rendered-review findings additionally attach `rendered_evidence` for screenshots, viewport
observations, accessibility-tree captures, or browser-console observations. The record names the
observed state and includes artifact, URL, viewport, and input method when those were captured.

The runtime validator and `src/fullstack-forge/schemas/finding.schema.json` enforce this contract.
Use:

```text
forge tool ingest-agent-findings .forge/agent-findings.json
```

Ingestion validates agent provenance, merges with an existing report, preserves report ledgers, and
rewrites Markdown and JSON together. It binds exact or unchanged-ancestor snapshots, rejects invalid
revision claims, demotes changed snapshots, and retains superseded historical findings separately
from active remediation. Missing, stale, unavailable, or unsupported evidence remains `NOT_VERIFIED`
or `BLOCKED`; it never becomes `PASS` by inference.
