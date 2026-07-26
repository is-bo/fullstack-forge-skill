# React and Next.js implementation

Owner: `forge-frontend`. Apply only after detecting the actual framework and version.

## Load when

- React or Next.js components, routes, rendering boundaries, data loading, or hydration are in
  scope.

## Do not load when

- The repository uses another frontend stack.
- A framework-independent review does not touch implementation.

## Rendering and data

Decide server and client ownership before coding. Keep the client boundary narrow and pass only data
that is safe and serializable. Start independent work together; avoid sequential data requests that
can be parallel, cached, streamed, or moved to the owning boundary. Define cancellation and stale
response behavior for client requests.

Derive renderable values during render when possible. Use effects to synchronize with external
systems, not as a general state-computation mechanism. Put user-triggered side effects in the event
that caused them. Avoid duplicating server data into state without an explicit editing model.

Use framework-native metadata, routing, image, font, error, loading, and not-found mechanisms when
the detected version supports them. Verify current project semantics before applying
version-specific advice. Do not add a dependency for a primitive the existing stack already
supplies.

## Delivery

Keep heavy or rarely used code out of the initial client bundle when measurement shows it matters.
Inspect serialization volume, hydration warnings, route transitions, chunk failures, and production
build behavior. Development timing and source shape are not release performance evidence.

## Evidence

- Detected framework/version and server/client boundary trace.
- Production build output and relevant route behavior.
- Tests for request races, loading, error, and optimistic rollback where applicable.
- Bundle or runtime measurements only when a performance claim is made.
