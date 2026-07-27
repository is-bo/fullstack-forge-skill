# Build brief: Payments

## Decide before coding

- Decide that the amount charged, refunded, or credited is always calculated and verified server-side; a client-supplied amount is never trusted, even as a default.
- Decide the webhook signature verification against the raw request body for every provider event before any handler trusts its payload.
- Decide the idempotency key for payment-affecting operations so a retried request or redelivered webhook cannot duplicate a charge, refund, or entitlement grant.
- Decide the reconciliation check between the provider's record, the internal ledger, and the granted entitlement, so a mismatch is detectable rather than silent.
- Decide the strict separation between test and live credentials, data, and webhooks before any payment code can run against a live account.

## Evidence to produce while building

- A test showing a client-supplied amount is ignored or rejected in favor of the server-calculated one.
- A test showing a tampered or unsigned webhook payload is rejected, and a validly signed one is processed exactly once.
- A test replaying the same webhook event or retried request, confirming no duplicate charge, refund, or entitlement.
- A reconciliation run comparing provider, ledger, and entitlement state for a representative sample.
- Confirmation that test and live credentials and data cannot cross into each other's paths.
