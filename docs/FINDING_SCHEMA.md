# Finding schema

The authoritative JSON Schema is `src/fullstack-forge/schemas/finding.schema.json`.

| Field            | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `id`             | Stable `FF-<MODULE>-<NNN>` identifier                                     |
| `section`        | Command module that owns the cause                                        |
| `title`          | Concise, causal summary                                                   |
| `severity`       | Potential impact: CRITICAL, HIGH, MEDIUM, LOW, INFO                       |
| `confidence`     | Evidence quality: HIGH, MEDIUM, LOW                                       |
| `status`         | PASS, FAIL, WARNING, NOT_APPLICABLE, NOT_VERIFIED, BLOCKED                |
| `location`       | Repository-relative paths and optional 1-based lines                      |
| `evidence`       | Reproducible observations; at least one is required                       |
| `impact`         | Concrete harm or audit consequence                                        |
| `recommendation` | Smallest appropriate remediation or next evidence step                    |
| `safe_fix`       | Whether an automatic fix is classified safe—not authorization to apply it |
| `verification`   | Exact checks that can close or confirm the finding                        |
| `standards`      | Relevant versioned criteria; never a compliance claim                     |

Analyzer findings may additionally contain:

- `analyzer_id`: the stable named analyzer that produced the finding;
- `trace`: source, sink, and trace-quality details used to assign confidence;
- `evidence_snapshot`: the audited file hash and evidence excerpt used to reject stale fixes; and
- `verification_plan`: analyzer, structural check, targeted command, fixture regression, or manual
  actions that must be evaluated independently.

Severity and confidence are independent. A critical low-confidence signal remains critical pending
triage. Verification appends evidence and preserves the original identifier, observation, and
evidence snapshot. A pattern that disappears without behavior-level proof remains `NOT_VERIFIED`.

A `PASS` requires affirmative evidence: direct code/configuration with location, a successful
automated check, inspected running behavior, a behavior-demonstrating test, or verified
configuration output. Missing evidence is `NOT_VERIFIED`; demonstrated non-applicability is
`NOT_APPLICABLE`.
