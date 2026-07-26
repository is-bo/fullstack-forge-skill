# Architecture

Fullstack Forge is an agent-first engineering system, not a universal scanner.

## Responsibility boundaries

- The AI agent understands intent, inspects the project, selects playbooks, reasons about design,
  implements code, adds tests, verifies behavior, and reports uncertainty.
- Forge skills provide applicability signals, production failure patterns, inspection and
  implementation procedures, safe-change boundaries, evidence rules, and completion contracts.
- The Forge CLI provides bounded inventory, discovery, deterministic analyzers where supported,
  command evidence, findings/reports, revision tracking, Build state, safe fixes, Verify/Ship gates,
  and platform installation.
- Project-native tools provide runtime-specific evidence.

## Canonical and generated assets

`src/fullstack-forge/` is the only canonical skill source. `npm run generate` renders 42 specialist
playbooks, three product/Build skills, 42 Build briefs, and independent copies under `.agents/`,
`.claude/`, `.cursor/`, `.gemini/`, `.github/skills/`, and `.windsurf/`. Generated ownership
manifests prevent clobbering local edits.

## Default feature flow

```text
UNDERSTAND → DISCOVER → SELECT → PLAN → IMPLEMENT → INSPECT → VERIFY → REPORT
```

The installed project instruction activates this flow. Direct repository evidence controls module
selection; generated Forge content, fixtures, examples, and dependency names are not final
capability evidence.

## Coverage modes

- `light`: small low-risk edits with focused evidence.
- `standard`: normal features with relevant modules, tests, and a final relevant pass.
- `high`: sensitive boundaries with stronger evidence and approval requirements.
- explicit Audit/Ship: user- or CI-requested inspection and release gates.

Build evidence and historical reports never satisfy Ship. Current, root- and revision-bound evidence
is required at each enforcement boundary.

## Installation ownership

The project manifest records installed files, platform, digest, ownership, file/section management,
package version, `agent_first`, and `automatic_activation`. Section-managed root instructions allow
user content outside the Forge markers to change safely. Symlinked destinations and path escapes are
refused.
