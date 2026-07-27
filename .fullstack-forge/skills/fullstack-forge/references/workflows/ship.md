# Ship workflow

Load this reference only for explicit release gating. Normal implementation, review, and
verification do not need Ship guidance.

`forge ship` is fail-closed. It combines current internal checks, project-native commands, a fresh
bounded inspection of the stable working-tree revision, and applicable high-risk capabilities.
Persisted reports and Build state are historical diagnostics, not Ship evidence.

Eligible positive evidence must come from a registered producer contract and bind the exact root,
revision, criterion, timestamp and expiry, inputs, output, and artifact hashes. Missing, stale,
malformed, cross-root, expired, unregistered, or artifact-mismatched evidence blocks rather than
passes.

Ship fails for open release-blocking findings, failed required gates, stale generated assets,
incomplete packaging, failed smoke installation, invalid attribution, or required high-risk checks
that remain unverified. Remote CI, CodeQL, publication, deployment, and production state require
their own direct evidence. A bypass must be explicit and authorized and is never represented as a
passing gate.
