# Build brief: Cache

## Decide before coding

- Decide whether caching is justified at all: name the measured latency or cost problem it solves. 'It might be slow later' is not justification. Concluding 'no cache and no Redis needed here' is a correct, complete answer — record it as a non-goal with the reason.
- If justified, decide the cache key, including tenant and user scope, so one caller never sees another caller's cached data.
- Decide invalidation: which write path busts or updates the entry, and what happens when invalidation itself fails.
- Decide the consistency requirement: is briefly stale data acceptable here, or does this path need read-your-writes guarantees.
- Decide failure behavior when the cache backend is unavailable: the feature must still work correctly, only slower, never wrong.
- Decide the TTL and whether sensitive or authorization-relevant data belongs in the cache at all.

## Evidence to produce while building

- The written justification, or the justified non-goal, for using or not using a cache on this path.
- The cache key scheme with tenant and user scoping visible in code.
- A test or trace showing invalidation fires on the actual write path, not only on a timer.
- A test showing correct behavior when the cache backend is unavailable or returns a miss.
- Confirmation that no sensitive or authorization-relevant data is served from cache without the same access check applied on read.
