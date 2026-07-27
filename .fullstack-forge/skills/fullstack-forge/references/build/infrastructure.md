# Build brief: Infrastructure

## Decide before coding

- Decide the least-privilege identity or role this feature's infrastructure needs before granting a broader existing role out of convenience.
- Decide what network exposure this feature actually requires (public, internal-only, none) before defaulting to open.
- Decide how secrets this feature needs reach the running service (secret manager, injected at deploy) before writing them into a config file or image.
- Decide resource limits (memory, CPU, connection counts) for anything new this feature runs, so it cannot silently consume unbounded capacity.
- Decide whether this infrastructure change is reversible through code (declarative, re-appliable) before making it by hand against a live environment.

## Evidence to produce while building

- The specific role or policy granted to this feature's infrastructure, showing it is scoped to what the feature needs.
- Confirmation that no new public network exposure was introduced without an explicit decision to do so.
- Confirmation that secrets reach the running service through the secret-management mechanism, not a committed file.
- The plan or validate output for this infrastructure change, run before any apply to a shared environment.
