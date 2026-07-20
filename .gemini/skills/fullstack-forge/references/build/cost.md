# Build brief: Cost efficiency

## Decide before coding

- Decide the cost driver this feature introduces (compute, storage, egress, a paid API, log volume) before it ships, so it has a named owner and expected magnitude.
- Decide the unit economics this feature's cost should be measured against (per user, per tenant, per request) if it scales with usage.
- Decide a budget or alert threshold for this feature's cost driver before it can grow unnoticed, especially for anything metered per call (AI, third-party APIs, egress).
- Decide against retry or fan-out patterns that would multiply cost on failure before they are the default behavior for this feature's calls to paid services.
- Decide the retention period for anything this feature logs or stores that carries an ongoing storage cost.

## Evidence to produce while building

- The named cost driver this feature introduces, with its expected per-unit magnitude.
- A budget or anomaly alert configured for any new metered or paid usage this feature introduces.
- Confirmation that failure-path retries on paid calls are bounded, not capable of unbounded cost amplification.
- A stated retention period for any new stored or logged data with an ongoing cost.
