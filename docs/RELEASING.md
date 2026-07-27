# Maintainer release guide

See [RELEASE.md](RELEASE.md) for the authoritative `v0.2.0` candidate, preview cleanup, and
publication sequence.

The short rule is: focused tests first, complete local validation once near the end, clean Ship
gate, remote CI, explicit release/tag inventory, dependency check, preview cleanup by exact names,
annotated tag, immutable release assets, then downloaded-byte verification. Never delete releases or
tags before the candidate passes, never force-push, and never report an unobserved remote result.
