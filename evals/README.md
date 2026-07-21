# Evaluations

The Node test suite treats every directory under `fixtures/` as an evaluation case. It verifies the
exact fixture set, capability discovery, secret redaction, and every case marked
`automated-signal-plus-manual-trace` or `automated-signal-plus-manual-browser-evaluation` by running
the real analyzer against a temporary fixture copy.

Run:

```bash
npm test -- --test-name-pattern="flawed fixtures"
```

Executable cases assert the stable finding ID, section, status, severity, location, evidence,
recommendation, and verification plan. The automated finding proves only the bounded source or
configuration shape; manual module procedures remain required for runtime, provider, policy, and
unsupported behavior claims.

`cases.json` is the exact 26-case evaluation catalog required for the deliberately flawed projects.
Each entry names the fixture, evaluation mode, prompt, module, and expected finding. Cases marked
`manual-evaluation` or `manual-browser-evaluation` must not be reported as automatically proven; the
prompt exists so a capable agent can gather the missing behavior evidence without inventing it.

## Build-mode prevention scenarios (`build-cases.json`)

Detection-mode evals prove an analyzer reproduces a finding against a deliberately flawed project.
Build mode has no such fixture to scan: prevention is about whether an agent working through
`forge new` / `forge feature <slug>` gets steered into the right tier and disciplines and cannot
reach `done` without real evidence. `build-cases.json` is the 11-scenario catalog for that
(`saas-start`, `dashboard-no-slop`, `registration-rbac`, `secure-upload`, `search-at-scale`,
`cache-justification`, `multi-tenant-resource`, `payment-webhooks`, `ai-invoice-hostile`,
`idempotent-background-job`, `offline-workflow`). Each entry names the brief given to an agent, the
expected entry point/tier/disciplines with the build brief that must be consulted, the expected
`.forge/build/` artifacts, the concrete defects the workflow must prevent, and an
`honest_completion` contract (`not_verified_until_evidence`, `never_waivable_at_high_tier`,
`done_refuses_without`).

Run:

```bash
npm test -- --test-name-pattern="prevention"
```

Each scenario's `verification` block is explicit about the split: `deterministic_summary` describes
what `scripts/tests/build-prevention-evals.test.mjs` proves by running the real compiled CLI
(`build/cli/src/build.js`) against a temporary project -- tier/discipline persistence, the high-tier
security-control lock (`accept-risk` refused, `done` refused, never silently PASS), and the
`cache-justification` scenario's legitimate `NOT_APPLICABLE` "no Redis needed" outcome.
`manual_notes` names what remains an agent/human judgment call (choosing the tier and disciplines
from the prompt, writing the actual negative tests, hostile-file fixtures, rendered UI states, or
adversarial injection tests the build briefs require) and is never asserted as automated proof.

## v0.3 Build-mode module corpus (`v030-build-mode/`)

`v030-build-mode/fixtures/` contains twelve small, synthetic, declarative tasks. The runner does not
execute fixture-provided code or contact a network; it dispatches only a fixed allowlist of cases to
stable Build-module exports. Each fixture declares one expected outcome, and the runner asserts it
exactly: `PASS`, `FAIL`, `BLOCKED`, or `NOT_VERIFIED`.

The corpus covers a basic executable change; the complete UI state/viewport matrix; authentication
and authorization; tenant isolation; hostile uploads; payment webhooks; migration and recovery
gates; privacy data flow; integrations blocked before execution; a failed registered producer; stale
and forged evidence demotion; and an actual synthetic v1-to-v2 state migration with rollback. All
fixtures contain only public, fictional values. A `PASS` in this corpus proves the named pure module
behavior or synthetic state transition, not a real provider, database, browser, or product
implementation.

Run it independently:

```bash
npm run test:evals:v030
```
