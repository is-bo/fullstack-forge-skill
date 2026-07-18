# Deliberately flawed fixtures

These twelve non-runnable projects contain synthetic patterns for local evaluator and fix-engine
tests. Package versions ending in `-fixture` do not identify installable dependencies. Values that
look credential-like are inert test strings. Never deploy, install, or copy these implementations
into an application.

Each `expected-findings.json` records capability detections, minimum tool observations, and relevant
specialist sections. `safe-fixes` contains only bounded structural changes; `risky-fixes` proves
that authorization and upload-policy findings remain blocked. Evaluations check executable findings
without pretending a supported static trace proves unsupported runtime behavior.
