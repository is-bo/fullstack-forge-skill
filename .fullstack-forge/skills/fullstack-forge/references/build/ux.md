# Build brief: User experience

## Decide before coding

- Name the primary user, task, environment, frequency, and consequence of failure before changing the journey; for a tiny behavior-preserving correction, record this proportionately inline.
- Enumerate every state this flow needs before coding it: loading, empty, error, success, and permission-denied, not only the happy path.
- Decide how a user recovers from each error state: what they are told, what they can retry, and what happens to the data they already entered.
- Decide that destructive or irreversible actions require an explicit confirmation step naming the consequence, before wiring the action handler.
- Decide what happens to user-entered input across a validation error, a network failure, and a session expiration; losing it is a decision, not an accident.
- Walk the adverse path (wrong input, cancel, back button, duplicate submit) as deliberately as the primary path before considering the flow designed.

## Evidence to produce while building

- A trace or recorded interaction for loading, empty, error, success, and permission-denied on this flow, not just the success case.
- Confirmation that a destructive action requires explicit confirmation and states what will be lost.
- A test showing user-entered data survives a validation error or a failed submit instead of being cleared.
- A repeat of the primary journey after refresh, retry, and duplicate submission, confirming one durable outcome.
