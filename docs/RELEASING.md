# Maintainer release guide

See [RELEASE.md](RELEASE.md) for the authoritative `v0.3.0` candidate and publication sequence.

The short rule is: focused tests first, complete local validation once near the end, clean Ship
gate, remote CI, explicit release/tag/attestation inventory, an annotated v0.3.0 tag, immutable
release assets, then downloaded-byte verification. The former v0.2.0 draft is already absent, the
v0.2.1 workflow failed before creating a draft, and v0.2.2 is already an immutable public release.
Do not create or recreate releases for v0.2.0 or v0.2.1, and never replace v0.2.2. Never move or
delete a release tag, never force-push, and never report an unobserved remote result. npm
publication is a separate, currently unconfigured action and must not be inferred from the GitHub
Release. The approving-review requirement observed for this candidate is `0`; do not describe
required status checks as proof that a human approval occurred.

Before a tag run, maintainers must provision `RELEASE_ADMIN_TOKEN` as a repository secret with
read-only repository Administration permission. GitHub's immutable-release settings endpoint
requires that permission and cannot be queried with the ordinary Actions `GITHUB_TOKEN`; the
workflow intentionally stops before drafting when the secret is absent or under-scoped. Attestation
verification also pins the signer to this release workflow, not merely to the repository.
