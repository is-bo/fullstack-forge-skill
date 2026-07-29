# Fullstack Forge v0.2.2 — Release preflight correction

v0.2.2 contains the complete upstream-powered runtime, packaging, upgrade, licensing, and
release-readiness corrections prepared for v0.2.1.

The v0.2.1 release workflow passed tagged-source verification, packaging, clean-room installation,
the genuine v0.1.0 upgrade, and offline installation, then stopped before creating a draft because
GitHub reports an unattested digest as HTTP 404. The preflight incorrectly treated that exact
response as an unknown failure.

v0.2.2 accepts that exact 404 as “missing” only after independently proving that the repository is
public. Private repositories, malformed responses, permission failures, network failures, and every
other lookup outcome remain fail-closed.

## Availability

This tagged-source document does not claim publication. Exact-head CI, CodeQL, the GitHub Release,
attestations, immutable assets, and downloaded-byte verification remain pending until observed.
`v0.2.0` and `v0.2.1` remain immutable historical tags without GitHub Releases. npm publication
remains unconfigured.

## Known limitations

- Live activation in each supported agent host remains `NOT_VERIFIED`.
- Analyzer precision against an independent external corpus remains `NOT_VERIFIED`.
- The measured context-efficiency target remains unmet and is not presented as passing.
