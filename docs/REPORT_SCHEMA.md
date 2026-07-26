# Report schema

The official outputs are `.forge/report.json` and `.forge/report.md`. They must contain the same
findings, verification state, and limitations, and the final agent response must not contradict
them.

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
rewrites Markdown and JSON together. Missing, stale, unavailable, or unsupported evidence remains
`NOT_VERIFIED` or `BLOCKED`; it never becomes `PASS` by inference.
