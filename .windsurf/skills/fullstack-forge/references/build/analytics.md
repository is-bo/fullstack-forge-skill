# Build brief: Analytics

## Decide before coding

- Decide the specific decision each new analytics event is meant to inform before adding it; an event with no owner or decision behind it is noise.
- Decide the event schema and identity model (anonymous versus authenticated, tenant property) before instrumentation is scattered across call sites.
- Decide which fields are excluded from this event because they are personal or sensitive, before the first event is sent.
- Decide how this event behaves under consent-denied, offline, and retry conditions, so it does not silently fire when it should not, or duplicate when retried.
- Decide the owner and destination for this event so it is not added speculatively with no consumer.

## Evidence to produce while building

- The decision or dashboard this new event is meant to inform, named explicitly.
- A trace of one triggered action producing exactly the expected event, with no duplicate or missing fire.
- Confirmation that no personal or sensitive field reaches this event's payload.
- A test showing the event respects a denied consent state and does not duplicate on retry.
