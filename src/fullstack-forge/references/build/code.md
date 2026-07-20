# Build brief: Code quality

## Decide before coding

- Decide the error-handling shape for this code before writing the happy path: what is caught, what propagates, and what the caller sees on failure.
- Decide ownership and cleanup for every resource opened (connections, streams, listeners, timers) at the point it is opened, not as an afterthought.
- Decide whether existing types and interfaces already model this data before introducing a parallel shape or an unsafe cast to force a fit.
- Decide what this change replaces or removes; do not leave the old path reachable dead code alongside the new one.
- Follow the newest established local precedent for structure and naming rather than an older pattern still present elsewhere in the codebase.

## Evidence to produce while building

- A passing run of the project's own format, lint, type-check, and unit-test commands after the final edit, with failures shown, not hidden.
- A file:line note on where an added resource is released or a promise is awaited, for anything non-obvious.
- Confirmation that removed or replaced code paths are actually unreachable, not still called from somewhere unexamined.
- A short note comparing the change to the nearest existing precedent it follows or deliberately departs from.
