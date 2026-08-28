# Fullstack Forge v0.3.1 release verification

Verification stage: CANDIDATE_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This record describes the locally validated v0.3.1 candidate. It does not claim a GitHub Release,
remote CI result, npm publication, attestation, or published asset before observation.

## Required local evidence

- [x] final generated-source and platform synchronization
- [x] format, lint, typecheck, unit, integration, evaluation, and coverage gates
- [x] dependency, secret, license, attribution, link, workflow, and traceability checks
- [x] deterministic platform archives, exact npm-pack artifact, SPDX SBOM, and checksums
- [x] exact-artifact clean-room installation, v0.1.0 and v0.2.2 upgrades, and offline installation
- [x] fail-closed Forge Ship decision with every unavailable proof reported

## Required remote evidence

- [ ] exact-head CI on Ubuntu, Windows, and macOS with the supported Node.js versions
- [ ] exact-head dependency review and CodeQL
- [ ] annotated `v0.3.1` tag bound to the verified merge commit
- [ ] GitHub Release assets, checksums, attestations, immutability, and downloaded-byte verification
- [ ] npm publication only if separately authorized and directly observed

## Current limitations

- Local candidate validation passed on Windows with Node.js 24; hosted cross-platform evidence
  remains pending.
- Live agent-host activation remains `NOT_VERIFIED`.
- Human approval is `NOT_VERIFIED`: the approving-review requirement observed for this candidate is
  `0`, so required status checks and administrator enforcement do not prove a review occurred.
- npm registry publication is `NOT_VERIFIED`; v0.3.1 is unpublished and publication is unconfigured.
- Remote CI, release, attestation, and immutable-asset state remain pending.
