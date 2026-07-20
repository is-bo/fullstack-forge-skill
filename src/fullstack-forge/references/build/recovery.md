# Build brief: Backup and recovery

## Decide before coding

- Decide which new durable data this feature introduces and confirm it falls under an existing backup scope before assuming it is covered.
- Decide the recovery point and recovery time this feature's data can tolerate before assuming the default backup schedule is adequate for it.
- Decide how this feature's data would be restored in isolation (without also restoring unrelated data) if only it needed to be recovered.
- Decide what happens to related state (queued jobs, cache entries, external references) if this feature's primary data is restored from an earlier point in time.
- Never claim a backup exists as recovery evidence without a tested restore; treat an untested backup as NOT_VERIFIED recovery capability.

## Evidence to produce while building

- Confirmation that this feature's new durable data is included in an existing, named backup scope.
- A restore of this feature's data performed in an isolated environment, with the recovery point and elapsed time recorded.
- A note on how dependent state (cache, queued jobs, external references) is reconciled after a restore.
- Explicit NOT_VERIFIED status for any recovery claim that has not been exercised, rather than an assumed PASS.
