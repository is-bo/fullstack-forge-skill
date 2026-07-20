# Build brief: Testing strategy

## Decide before coding

- Decide the tests for this feature while writing it, not after; a feature without its own tests is not complete regardless of how it looks running.
- Decide adequacy by risk, not line count: authorization, tenant-isolation, and failure-path tests matter more here than covering every trivial branch.
- Decide what a test in this feature would need to break to catch the defect it claims to detect, before writing an assertion that would pass regardless.
- Decide the boundary each test actually exercises; do not mock the exact behavior under test into a tautology.
- Decide which adverse and recovery paths (timeout, duplicate, cancellation, partial failure) get a test alongside the happy path.

## Evidence to produce while building

- Tests committed alongside the feature they cover, not deferred to a later pass.
- At least one authorization, tenant-isolation, or failure-path test for any feature touching those risks.
- A demonstration that a targeted test fails when the behavior it claims to protect is broken, and passes when fixed.
- A clean run of the full relevant suite after the final edit, with no hidden or skipped failures.
