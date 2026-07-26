# Product gap report — v0.5.1

This report records the Codex onboarding gaps addressed by the v0.5.1 patch. It is a public,
implementation-scoped record derived from the requested user experience; it contains no private
specification or local Forge state.

## Observed gaps

| ID           | Gap                                                                               | User impact                                                                 |
| ------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| FF-CODEX-101 | Only the audit-oriented `fullstack-forge` metadata was visible in the picker.     | New users could reasonably conclude that Forge was audit-only.              |
| FF-CODEX-102 | The beginner `forge` router had no `agents/openai.yaml` metadata or branded icon. | Its product entrance and action vocabulary were not previewed by Codex.     |
| FF-CODEX-103 | The router did not prescribe a concrete no-action response.                       | Selecting the skill alone could produce an abstract question or an audit.   |
| FF-CODEX-104 | The terminal menu omitted a separate apply-safe choice and used nine entries.     | Codex and terminal onboarding described different action sets.              |
| FF-CODEX-105 | Plain-language ambiguity for `audit data` was not bounded explicitly.             | A broad data request could not offer the most useful compact clarification. |
| FF-CODEX-106 | Generated Build command copies carried only `SKILL.md`.                           | Router metadata and assets could not be owned and synchronized safely.      |
| FF-CODEX-107 | Public descriptions and Codex documentation remained partly audit-first.          | Users could mistake internal actions for nested native picker commands.     |

## Acceptance boundary

The patch must expose Build, Continue, Audit, Fix, Verify, Ship, Status, and Help without adding a
new evidence producer or execution path. The existing expert skills, schemas, authorization
boundaries, fail-closed statuses, and independent Ship gate must remain unchanged. Live rendering
inside every vendor host remains external evidence and cannot be inferred from file structure.
