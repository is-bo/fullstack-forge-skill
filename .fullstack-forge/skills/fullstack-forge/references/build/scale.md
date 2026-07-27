# Build brief: Scalability

## Decide before coding

- Decide the actual growth scenario (users, data, tenants, load concentration) this feature must survive before adding capacity for one that is not demonstrated.
- Decide against unneeded complexity by default: concluding 'no microservices, queue, Kubernetes, or second database needed here' is a correct, complete answer when growth is not shown, and must be recorded as such.
- Also check the opposite failure: decide whether an existing bottleneck (a hot row, unbounded fan-out, single connection pool) this feature adds load to actually needs addressing now.
- Decide the partition or scoping key (tenant, user, shard) this feature's data uses, so a hot key or hot tenant does not degrade every other tenant.
- Decide what happens under load beyond capacity: shed load, queue it with a bound, or degrade a specific feature, rather than leaving it undefined.

## Evidence to produce while building

- The specific growth number or scenario that justified any new infrastructure, or the recorded non-goal explaining why none was needed.
- A note identifying the partition or scoping key used to avoid a hot row or hot tenant, where relevant.
- A test or trace showing behavior at or beyond the stated capacity target (rate limit engaged, queue bounded, load shed), not just at normal load.
- Confirmation that one tenant's load cannot starve another's on a shared resource this feature touches.
