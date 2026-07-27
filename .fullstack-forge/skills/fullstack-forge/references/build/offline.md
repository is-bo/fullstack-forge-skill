# Build brief: Offline behavior

## Decide before coding

- Decide what this feature stores locally, for how long, and whether it is encrypted, before writing anything to a local store or cache.
- Decide the conflict-resolution rule for this feature's data before two offline edits can collide, rather than discovering the collision behavior by accident.
- Decide the idempotency key for queued offline actions so replaying a queue after reconnect does not duplicate the effect.
- Decide what happens to locally cached private data when the user logs out, is revoked, or switches accounts on a shared device.
- Decide how a long-offline or stale client is treated on reconnect: whether its cached authorization is still trusted, or must be re-verified.

## Evidence to produce while building

- A test exercising a sync conflict (two offline edits to the same record), confirming the decided resolution rule applies.
- A test replaying a queued offline action twice, confirming one durable effect.
- Confirmation that logout or revocation clears this feature's locally cached private data.
- A test showing a stale or long-offline client has its authorization re-verified on reconnect rather than trusted as-is.
