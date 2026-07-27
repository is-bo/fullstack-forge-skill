# Build brief: External integrations

## Decide before coding

- Decide the timeout, bounded retry, and fallback behavior for this integration before the happy-path call is wired, since the provider will fail eventually.
- Decide how an inbound webhook's signature is verified against the raw request body, and reject anything that fails, before trusting its payload.
- Decide how duplicate and out-of-order webhook events are handled, since providers redeliver and do not guarantee ordering.
- Decide what credential scope this integration actually needs, and use the narrowest one available rather than a broad default.
- Decide what happens to the user-facing flow when this provider is down or rate-limited, rather than letting the failure surface as an unhandled error.

## Evidence to produce while building

- A test showing a tampered or unsigned webhook payload is rejected, and a validly signed one is accepted.
- A test replaying the same webhook event twice, confirming one durable effect.
- A trace showing the integration's timeout and retry behavior under a simulated slow or failing provider.
- Confirmation that credentials for this integration are scoped to only what this feature needs and are not logged.
