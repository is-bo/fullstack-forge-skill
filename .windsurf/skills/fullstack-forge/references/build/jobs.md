# Build brief: Background jobs

## Decide before coding

- Decide the idempotency key or check for this job before writing the handler, so redelivery produces one durable effect, not several.
- Decide the retry policy: bounded attempts, backoff, and where the job ends up (dead-letter, alert, discard) after retries are exhausted.
- Decide the transaction boundary between the triggering write and the enqueue, so a job is never enqueued for a write that did not commit, or vice versa.
- Decide what a poison message looks like for this job and how it is detected and quarantined instead of retried forever or silently dropped.
- Decide how this job behaves during a deploy: safe to run mid-shutdown, safe with an older or newer payload shape in flight.

## Evidence to produce while building

- A test delivering the same job payload twice, confirming one durable outcome, not duplicated side effects.
- A forced-failure test showing the job reaches its dead-letter or alerting path after exhausting retries, rather than retrying indefinitely.
- Confirmation that the enqueue only happens after (or atomically with) the triggering write commits.
- A trace or log showing job outcome, attempt count, and identifying payload version are observable after the fact.
