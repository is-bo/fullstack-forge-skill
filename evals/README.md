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
