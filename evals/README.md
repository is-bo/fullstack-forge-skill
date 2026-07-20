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
