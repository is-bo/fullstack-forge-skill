# Maintainer release guide

See [RELEASE.md](RELEASE.md) for the authoritative `v0.2.1` candidate and publication sequence.

The short rule is: focused tests first, complete local validation once near the end, clean Ship
gate, remote CI, explicit release/tag/attestation inventory, an annotated v0.2.1 tag, immutable
release assets, then downloaded-byte verification. The former v0.2.0 draft is already absent; do not
recreate it. Never move or delete the v0.2.0 tag, never force-push, and never report an unobserved
remote result.
