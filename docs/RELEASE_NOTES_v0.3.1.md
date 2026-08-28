# Fullstack Forge v0.3.1 — Immutable downloadable release

v0.3.1 carries the validated v0.3.0 feature set forward under a fresh release identity so it can be
published as one immutable, downloadable GitHub Release without moving or reusing a historical tag.

## Included functionality

- Evidence-gated automatic module selection and bounded specialist coordination.
- Fail-closed audit, fix, verification, offline, and release evidence handling.
- Portable generated adapters for supported agent hosts and a first-class Codex plugin manifest.
- Deterministic platform archives, an exact npm-pack artifact, SPDX SBOM, checksums, clean-room
  installation, and exact-commit CI and CodeQL release gates.
- A one-message AI-agent installation prompt pinned to the exact v0.3.1 release package.

## Availability

This candidate document does not claim publication. Exact-head CI, CodeQL, the GitHub Release,
attestations, immutable assets, and downloaded-byte verification remain pending until directly
observed. v0.2.2 remains the current immutable public release during candidate validation.

The npm package is not published, and the GitHub Release workflow does not publish it. Registry
publication remains `NOT_VERIFIED`; the Codex marketplace entry therefore remains unavailable.

## Known limitations

- Live activation in every supported agent host remains `NOT_VERIFIED` until exercised there.
- Remote CI, registry, release, and production state cannot be proved by local repository checks.
- Deterministic analyzers cover only their declared frameworks and shapes; unsupported boundaries
  remain agent-inspected and explicitly unverified where evidence is unavailable.
