# Build brief: Query behavior

## Decide before coding

- Decide how this feature avoids N+1 queries before writing the loop that would trigger one (batch load, join, or explicit prefetch).
- Decide that every list endpoint has both pagination and a deterministic ordering (a tie-broken sort key), so results are stable and bounded from the first version, not retrofitted later.
- Decide indexes from the actual access pattern this feature introduces, not a guess; check the real query shape (filters, sort, joins) before adding or skipping an index.
- Decide the transaction boundary for any multi-step write so it is bounded, does not hold locks across an external call, and leaves data consistent on partial failure.
- Decide that all user-controlled values reach the query through parameterization, never string-built into the query text.

## Evidence to produce while building

- A query-count trace or test showing this feature does not issue an N+1 pattern under representative data.
- A test showing paginated results are stable and complete (no skipped or duplicated rows) under concurrent writes.
- The specific access pattern (filter, sort, join) that justified a new index, or a note that existing indexes already cover it.
- A test showing a multi-step write either fully commits or fully rolls back on failure.
