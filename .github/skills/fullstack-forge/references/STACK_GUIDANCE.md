# Evidence-driven stack guidance

Detect before selecting commands. Give strongest weight to lockfiles, workspace manifests, imports,
framework configuration, CI commands, and deployment files. Record confidence and conflicting
evidence.

- JavaScript/TypeScript: respect the detected package manager and pinned runtime; inspect scripts
  before running them. Distinguish browser, server, edge, worker, and build-time code.
- Python: find the actual environment and lock format; distinguish framework commands from arbitrary
  module execution and inspect async/database lifecycle.
- JVM/.NET/Go/Rust: use checked-in wrappers and module/workspace metadata; trace generated code and
  framework middleware to the final boundary.
- Mobile/desktop: inspect platform entitlements, local storage, deep links, updates, offline
  behavior, and native accessibility in addition to shared application code.
- Databases: inspect generated queries and applied constraints, not ORM declarations alone. Never
  claim a plan, lock impact, or production cardinality without direct output.
- Serverless/edge: inspect timeout, concurrency, cold start, regional state, retry, and runtime API
  limitations rather than assuming a conventional server process.

When the stack is unfamiliar, document the gap and use primary vendor or standards documentation. Do
not transplant a control whose semantics have not been verified for the detected version.
