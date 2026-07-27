# Build brief: Orchestrated audit

## Decide before coding

- Decide when a full cross-discipline audit belongs in this project's flow: at explicit checkpoints (before a release, after a risk tier change, on operator request), never after every small feature as a routine step.
- Decide the scope for a given audit (changed files versus full repository) before running it, based on what actually changed and its risk.
- Decide that build-time evidence from individual features does not substitute for this audit; it re-derives its own evidence independently.
- Decide who reviews and prioritizes the merged findings before any risky fix is applied from them.
- Decide which findings are acceptable to leave open with a recorded reason versus which block moving forward.

## Evidence to produce while building

- A recorded trigger explaining why this audit ran now (checkpoint, risk change, explicit request), not as a default step after routine feature work.
- The scope decision (changed versus full) with its reasoning.
- A merged, deduplicated finding set ranked by severity, confidence, impact, and effort, with raw per-module evidence preserved.
- Explicit NOT_VERIFIED or blocked markers for any check that could not run, rather than an assumed pass.
