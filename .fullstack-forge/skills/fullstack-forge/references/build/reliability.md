# Build brief: Reliability

## Decide before coding

- Decide the timeout for every external or downstream call this feature makes before the call is written; an unbounded call is an outage waiting to happen.
- Decide the retry policy (bounded attempts, backoff, jitter) and which failures are worth retrying versus failing fast.
- Decide the user-visible or system behavior when a dependency this feature relies on is unavailable: degrade, queue, or fail clearly, not hang.
- Decide whether this feature's operations are safe to run twice (idempotent) given the retries and timeouts just decided.
- Decide how this feature behaves during a deploy or restart mid-operation: safe to interrupt, safe to resume.

## Evidence to produce while building

- A test injecting a dependency timeout or failure, confirming this feature degrades or fails clearly instead of hanging.
- A test showing a retried operation produces one durable outcome, not a duplicated effect.
- Confirmation of the bounded timeout and retry configuration actually applied at the call site, with a file:line reference.
- A test showing recovery after an interrupted operation leaves no partial or duplicated state.
