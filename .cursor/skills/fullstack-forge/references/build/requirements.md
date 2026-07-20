# Build brief: Requirements and domain logic

## Decide before coding

- Write down the acceptance criteria for success, empty, error, retry, cancellation, and partial-failure paths before coding any of them; an untested path is an unwritten requirement.
- Resolve contradictory or ambiguous business rules with an accountable owner before encoding a guess as behavior.
- Decide the exact rule for money, dates, time zones, and rounding used in this feature, not just the general convention, when the domain touches any of them.
- Decide who owns a record or action and what happens to dependents when ownership changes or the owner is removed.
- Decide the behavior for duplicate submission, retry after timeout, and resuming a partially completed operation.

## Evidence to produce while building

- A test per stated business rule, including the adverse and recovery paths, not only the happy path.
- A file:line trace from each acceptance criterion to the code that enforces it.
- Evidence that a duplicate or retried request produces one durable outcome, not a duplicated one.
- A note on any requirement that stayed ambiguous, and who was asked, rather than silently assumed.
