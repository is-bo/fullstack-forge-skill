# Build brief: Architecture

## Decide before coding

- Decide the module or service boundary for this feature and the direction dependencies must flow before writing code that crosses it either way.
- Decide whether this feature needs a new service, queue, or data store at all: naming the specific failure the current topology cannot handle. Concluding 'no new service, queue, or database needed' is a correct, complete answer when growth is not demonstrated.
- Identify the one critical request path this change sits on and decide how it behaves end to end, including what happens when a downstream step fails.
- Decide where domain logic lives (not scattered across UI, route handler, and job) so the same rule cannot drift into two different answers.
- Flag any place this change would introduce a cycle, shared mutable state, or a new single point of failure, and decide how to avoid it instead of accepting it.

## Evidence to produce while building

- A short trace of the critical path this feature sits on, from entry point to durable effect, with file references.
- The specific measured or stated requirement that justified any new service, queue, cache, or store, or the recorded reason none was needed.
- Confirmation that domain logic lives in one place, not duplicated across layers.
- A note identifying any accepted complexity (a cycle, a shared singleton, a sync call that should be async) with the reason it was accepted.
