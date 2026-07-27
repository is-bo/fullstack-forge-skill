# Build brief: Release readiness

## Decide before coding

- Decide this gate runs before an actual release candidate, not after every merged feature; treat it as a checkpoint, not routine CI noise.
- Decide the fail-closed rule up front: any open critical finding, required high-severity finding, failed required check, or required high-risk NOT_VERIFIED status blocks shipping, with no implicit override.
- Decide that this gate re-runs the real checks (format, lint, type, tests, build, security, migrations) itself rather than trusting a feature's own recorded build-time evidence.
- Decide what residual risk, if any, is acceptable to ship with, and require an explicit, recorded acceptance for it rather than a silent gap.
- Decide the rollback or forward-fix plan exists and is understood before this release goes out, not improvised after an incident.

## Evidence to produce while building

- A full gate run immediately before this release candidate, with every check's actual pass/fail status, not inherited from earlier build-time state.
- Confirmation that no open critical or required high-severity finding remains, or an explicit recorded risk acceptance for each exception.
- A clean install and smoke test of the packaged release artifact in an isolated environment.
- The rollback or forward-fix plan for this release, confirmed before publication.
