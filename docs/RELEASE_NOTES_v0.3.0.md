# Fullstack Forge v0.3.0 — Evidence-gated orchestration and portable distribution

v0.3.0 makes Forge more selective, more portable across agent hosts, and more explicit about what
was actually verified.

## Orchestration and discovery

- Automatic activation now relies on direct request and repository evidence, with generated files,
  examples, fixtures, comments, and unresolved capabilities prevented from becoming positive proof.
- Module coordination uses one bounded, evidence-gated direct dependency hop, keeping related
  security, authorization, data, testing, and reliability owners involved without loading the full
  dependency graph.
- The standalone composition runtime and the installed CLI share the same selection and dependency
  policy, and thin host adapters invoke that packaged runtime without requiring a global Forge
  executable.

## Verification and release integrity

- Offline, unauthorized, skipped, and failed project commands retain terminal ledger evidence and
  cannot be represented as successful execution.
- Audit, safe-fix, and Verify flows preserve applicable `BLOCKED` and `NOT_VERIFIED` outcomes rather
  than turning missing evidence into a clean result.
- Release packaging adds the exact deterministic npm-pack artifact, an SPDX 2.3 SBOM, checksums,
  clean-room installation, immutable-release discovery, and exact-commit CI and CodeQL gating.
- Codex receives a first-class plugin manifest, repository marketplace metadata, and generated thin
  skill adapters that resolve the same canonical playbook tree as every other host.

## Preserved specialist expertise

The existing public Forge modules and the licensed, pinned upstream provider set remain intact.
Provider content stays inert outside Forge composition, provenance and attribution remain bundled,
and new ecosystem candidates are not vendored without explicit license and overlap review.

## Availability

This locally validated candidate document does not claim publication. Exact-head CI, CodeQL, the
GitHub Release, attestations, immutable assets, and downloaded-byte verification remain pending
until directly observed. v0.2.2 remains the current immutable public release.

The npm package is not published and the GitHub Release workflow does not publish it. Registry
publication remains `NOT_VERIFIED`; the Codex marketplace entry therefore remains unavailable until
a separate npm publication is observed.

## Known limitations

- Live activation in every supported agent host remains `NOT_VERIFIED` until exercised there.
- Remote CI, registry, release, and production state cannot be proved by local repository checks.
- Deterministic analyzers cover only their declared frameworks and shapes; unsupported boundaries
  remain agent-inspected and explicitly unverified where evidence is unavailable.
