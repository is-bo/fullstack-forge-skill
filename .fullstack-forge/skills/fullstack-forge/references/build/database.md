# Build brief: Database design

## Decide before coding

- Decide the constraints this schema enforces at the database level (primary key, foreign key, unique, not-null, check) before relying on application code alone to keep data valid.
- Decide the concrete type for money and dates now (a precise decimal type and an explicit time-zone-aware type), never a floating-point number or a naive local timestamp.
- Decide whether a new migration is expand-contract-compatible with the currently running code, so deploy order does not require simultaneous application and schema changes.
- Decide the tenant-scoping column and its inclusion in relevant uniqueness constraints before the table exists, if this data is tenant-owned.
- Decide the rollback or forward-fix plan for this migration before applying it to any shared environment, including its behavior on a large existing table.

## Evidence to produce while building

- The applied schema showing the declared constraints (not just ORM-level validation) actually exist in the database.
- A test confirming money and date columns use the decided precise, time-zone-aware types, not floating-point or naive values.
- A migration run against both an empty database and a representative populated one, showing it applies safely.
- Confirmation of the rollback or forward-fix path exercised for this migration, not merely described.
