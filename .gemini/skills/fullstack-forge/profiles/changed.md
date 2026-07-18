# Changed-scope profile

1. Discover the repository and compute the merge-base change set without modifying it.
2. Expand scope to callers, callees, schemas, routes, policies, tests, generated artifacts, and
   deployment surfaces affected by the change.
3. Always include code, testing, docs, and supply-chain checks when applicable.
4. Add authentication, authorization, tenancy, uploads, payments, AI, data, or infrastructure
   modules when the change crosses those boundaries.
5. Report explicitly what was excluded and why. "Changed" never means diff-only reasoning.
