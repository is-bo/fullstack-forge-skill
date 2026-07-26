# Report workflow

Load this reference only when producing, ingesting, or rendering formal findings and reports. Follow
the [evidence protocol](../PROTOCOL.md) and the finding schema.

Keep `.forge/report.json`, `.forge/report.md`, and the final agent response consistent. Include:

- scope, root, revision, timestamp, environment, and tool versions;
- applicability decisions and project-profile limitations;
- findings grouped by severity with confidence, status, evidence, impact, recommendation, safe-fix
  classification, verification, and standards;
- deduplicated root causes while preserving every affected location;
- commands run, failures, skipped or blocked checks, assumptions, and residual risk.

Agent findings use `agent-reviewed-source`, `agent-rendered-review`, or
`agent-runtime-verification`. Rendered findings must attach the actual artifact or viewport
observation. Validate agent findings before ingestion. Reports remain useful when all criteria are
`NOT_APPLICABLE` or `NOT_VERIFIED` and never conceal a report-generation failure.
