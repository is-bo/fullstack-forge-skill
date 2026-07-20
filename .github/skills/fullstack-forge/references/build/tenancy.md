# Build brief: Multi-tenancy

## Decide before coding

- Decide the trusted source of tenant context for this feature (session, verified token, never a client-supplied field alone) before writing the first query.
- Decide that every query, cache key, file or object path, and background job carries and enforces tenant scope; a shared helper that cannot be bypassed by a raw query is preferred over per-call discipline.
- Decide what happens when tenant context is missing, forged, or stale: reject, never default to a broad or first-match tenant.
- Decide how tenant scope survives into asynchronous work (jobs, scheduled tasks, webhooks) where the original request context no longer exists.
- Decide the negative test for this feature now: what does another tenant's identical request return, and it must not be another tenant's data.

## Evidence to produce while building

- A cross-tenant negative test for every new endpoint or resource, confirming another tenant's request is denied or not-found, never leaked.
- A file:line trace showing the tenant filter reaches the actual query, cache key, or storage path, not just the route handler.
- A test showing a background job or scheduled task re-establishes trusted tenant context rather than inheriting an ambient one.
- Confirmation that missing or forged tenant context is rejected, not defaulted.
