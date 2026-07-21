# Security policy

## Supported version

Security fixes are provided for the latest released version. During the `0.x` series, users should
upgrade to the newest patch before reporting a resolved issue.

## Report a vulnerability

Use GitHub private vulnerability reporting for `thethunderbolt/fullstack-forge-skill` when
available. Do not open a public issue containing an exploit, credential, personal data, or an
affected user's repository content. If private reporting is unavailable, contact the repository
owner privately through their GitHub profile and request a secure channel before sharing details.

Include the affected version, environment, minimal reproduction, impact, and any known workaround.
Do not test against systems or data you do not own or have permission to assess.

## Security model

- Audits are read-only unless the user explicitly requests a fix.
- Project commands require `--allow-run`; command definitions are displayed for review.
- Platform selectors are allowlisted and destinations are constrained beneath the selected root.
- Existing symlinks, path traversal, unowned conflicts, and modified owned files are refused.
- Uninstall removes only files whose installed hash still matches the ownership manifest.
- Secret scanners redact values and never establish that a credential is valid.
- Build positive outcomes require exact registered producers and typed evidence envelopes bound to
  the current root, revision, expiry, inputs, and artifacts; unavailable evidence never becomes
  `PASS`, and Build evidence has no Ship authority.
- `forge ship` re-discovers and re-inspects the current stable revision. Persisted reports are
  diagnostics only, command claims are definition/input/output-bound, and rejected evidence is
  retained only as `NOT_VERIFIED`.
- Legacy v0.2 Build state is migrated only through the explicit journaled command, with validated
  hash-bound backups, resumable application, and rollback. No Build command migrates state on load.
- Packages use explicit source roots and reject local-specification, Git, temporary, dependency, and
  symlink content.

See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for threats, trust boundaries, and residual
risks.
