# Fullstack Forge v0.2.2 release verification

> Historical candidate record. v0.2.2 was subsequently published as an immutable GitHub Release on
> 2026-07-29. The statuses and counts below intentionally preserve the evidence available before
> publication; use `docs/RELEASE.md` for the current release state.

Verification stage: CANDIDATE_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This record describes the v0.2.2 candidate. It does not claim a GitHub Release, remote CI result,
attestation, or published asset before observation.

## Required local evidence

- [x] attestation-lookup regression and fail-closed failure cases
- [x] complete format, lint, typecheck, test, coverage, validation, packaging, install, upgrade,
      offline, licence, workflow, and deterministic-generation checks
- [x] genuine public v0.1.0-to-v0.2.2 upgrade, including stale-file, renamed-module,
      removed-provider, installed-host-scope, and user-content-preservation cases
- [x] composition evaluation: 40/40 cases, including 13/13 saturated-budget cases and 134 expected
      suppressions
- [x] package validation: nine archives, 9,777 aggregate entries, and 644 resolved adapters
- [x] npm candidate inspection: 1,646 entries; exact byte totals are captured from the final tagged
      source rather than hard-coded into the payload that determines them
- [x] clean candidate Ship gate

## Required remote evidence

- [ ] exact-head CI on Ubuntu, Windows, and macOS with Node 20, 22, and 24
- [ ] exact-head dependency review and CodeQL
- [ ] annotated `v0.2.2` tag bound to the verified merge commit
- [ ] GitHub Release assets, checksums, attestations, immutability, and downloaded-byte verification

## Historical partial-release evidence

- `v0.2.1` tag object: `d4a1945289072af8c48f0e43f15dc9118fb891f1`
- `v0.2.1` tagged commit: `5b12b416885a9e6ca227ac2c3a51fd592bd3b1b3`
- failed release workflow: `30460586017`
- the failure occurred before attestation creation, draft creation, asset upload, or publication

The final local test run passed 1,133 tests with one capability-based skip because this Windows
account cannot create symlinks. Coverage thresholds passed at 91.17% lines, 82.49% branches, and
91.24% functions. `npm audit --ignore-scripts` reported zero vulnerabilities.

## Limitations

- Live agent-host activation is `NOT_VERIFIED`.
- Independent external-corpus precision remains `NOT_VERIFIED`.
- The measured context-efficiency target remains unmet.
