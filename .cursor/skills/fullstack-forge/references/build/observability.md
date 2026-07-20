# Build brief: Observability

## Decide before coding

- Decide what operational question this feature must be able to answer after shipping (is it failing, for whom, how slow) before deciding what to log.
- Decide the correlation identifier that ties this feature's request, job, and downstream calls together in telemetry before writing the first log line.
- Decide which fields must never appear in logs or metrics for this feature (secrets, personal data, high-cardinality free text) before instrumentation is added.
- Decide whether a failure in this feature needs an alert, and what the alert's actionable next step is, rather than adding a metric no one is paged on.
- Decide the log level and event name convention this feature follows, matching what already exists rather than inventing a new taxonomy.

## Evidence to produce while building

- A generated success and a generated failure for this feature, both locatable in logs, metrics, or traces by the same correlation identifier.
- Confirmation that no secret or personal-data field appears in this feature's telemetry.
- The alert (if any) tied to this feature's critical failure mode, with its actionable runbook reference.
- Confirmation that new log or metric names follow the project's existing naming and level conventions.
