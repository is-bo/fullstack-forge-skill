# Deliberately flawed fixtures

These ten non-runnable projects contain synthetic, intentionally unsafe patterns for local evaluator
tests. Package versions ending in `-fixture` do not identify installable dependencies. Values that
look credential-like are inert test strings. Never deploy, install, or copy these implementations
into an application.

Each `expected-findings.json` records capability detections, minimum tool observations, and relevant
specialist sections. Evaluations check detection coverage without pretending a pattern match proves
the entire defect or remediation.
