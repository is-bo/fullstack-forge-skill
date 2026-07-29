# Maintainer release guide

See [RELEASE.md](RELEASE.md) for the authoritative `v0.2.2` candidate and publication sequence.

The short rule is: focused tests first, complete local validation once near the end, clean Ship
gate, remote CI, explicit release/tag/attestation inventory, an annotated v0.2.2 tag, immutable
release assets, then downloaded-byte verification. The former v0.2.0 draft is already absent, and
the v0.2.1 workflow failed before creating a draft; do not create or recreate releases for either
historical tag. Never move or delete either tag, never force-push, and never report an unobserved
remote result.
