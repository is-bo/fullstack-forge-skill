# Component architecture

Owner: `forge-frontend`. Visual tokens belong to `forge-ui`; workflow semantics belong to
`forge-ux`.

## Load when

- Creating or changing reusable components, shared state, variants, component APIs, or library
  primitives.
- React, Vue, Svelte, or native UI composition is part of the request.

## Do not load when

- A local content or token substitution does not change structure, state, or reuse.

## Boundaries and APIs

Start from the nearest established component. Separate domain behavior from rendering, and keep
state as close as practical to the owner of the interaction. Prefer composition and explicit
variants over boolean-prop combinations whose states can conflict. Expose a stable
state/actions/metadata contract when children must coordinate without knowing the storage
implementation.

Do not extract a component because markup repeats once. Extract when a shared contract or consistent
behavior matters. Conversely, do not copy a complex control merely to avoid understanding its API.
Keep public component interfaces smaller than their implementation details.

Model states explicitly and make impossible combinations unrepresentable where the language permits.
Keep controlled and uncontrolled behavior deliberate. Ensure listeners, subscriptions, observers,
timers, requests, and object URLs have clear cleanup ownership.

## Verification

- Exercise every supported variant and state, including invalid combinations at the type or test
  boundary.
- Verify consumer behavior, not only an isolated snapshot.
- Check rerender and bundle claims only with measured evidence.
- Record any public API migration and the callers inspected.
