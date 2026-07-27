# Build brief: API design and implementation

## Decide before coding

- Decide the request and response schema, status codes, and error envelope for this endpoint before implementing the handler, and validate both directions against it.
- Decide the object-level authorization check for this endpoint: which caller may act on which specific resource, not only that the caller is authenticated.
- Decide pagination, filtering limits, and maximum payload size for any endpoint returning or accepting a list, before it can be asked to return everything at once.
- Decide whether this operation must be idempotent (retryable without a duplicate effect) and design the key or check for that before the write path exists.
- Decide what happens to this contract when a future change is needed: is this a breaking change, and if so, what is the versioning or deprecation path.

## Evidence to produce while building

- A negative test showing invalid input and unauthorized object access are both rejected with the intended status code.
- A test replaying the same idempotent request twice, confirming exactly one durable effect.
- Confirmation that response payloads expose only intended fields, not full internal records.
- A trace showing pagination and size limits are enforced at the actual handler, not assumed from the client.
