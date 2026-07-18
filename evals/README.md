# Evaluations

The Node test suite treats every directory under `fixtures/` as an evaluation case. It verifies the
exact fixture set, capability discovery, minimum executable-tool signals, and secret redaction.

Run:

```bash
npm test -- --test-name-pattern="flawed fixtures"
```

Expected files intentionally describe minimum evidence, not automatic compliance verdicts. Manual
module procedures remain required for authorization, accessibility, runtime, provider, and policy
claims.

`cases.json` is the exact 26-case evaluation catalog required for the deliberately flawed projects.
Each entry names the fixture, evaluation mode, prompt, module, and expected finding. Cases marked
`manual-evaluation` or `manual-browser-evaluation` must not be reported as automatically proven; the
prompt exists so a capable agent can gather the missing behavior evidence without inventing it.
