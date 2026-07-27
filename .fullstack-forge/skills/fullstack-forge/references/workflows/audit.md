# Audit workflow

Load this reference for an explicit audit or directly relevant inspection that will produce formal
findings. Do not load it merely because Forge activated for a small implementation task.

1. Establish the exact repository root, requested scope, revision, risk focus, and read-only
   boundary.
2. Inspect repository instructions, version-control state, manifests, CI, and command definitions.
3. Build a bounded Git-aware inventory. Respect ignored, generated, vendored, cache, environment,
   binary, runtime-data, example, fixture, and test classifications.
4. Discover applications, workspaces, routes, identity and tenant boundaries, data stores, delivery
   systems, integrations, AI, payments, and critical workflows from direct evidence.
5. Select only applicable modules. Trace at least one critical path end to end and inspect the final
   server, data, storage, job, provider, or tool-execution sink.
6. Run safe read-only checks after inspecting their definitions. Capture command, exit code,
   relevant output, duration, and limitations.
7. Create stable findings under the [evidence protocol](../PROTOCOL.md). Missing or partial evidence
   remains `NOT_VERIFIED` or `BLOCKED`; absence of a simple pattern is not a pass.

Changed-scope audits include committed, staged, unstaged, renamed, deleted, and relevant untracked
files, then expand only through evidenced dependencies and shared boundaries. Full audits inspect
the complete applicable project within the bounded inventory. Concurrency is allowed only for
independent read-only checks whose outputs and environments cannot interfere.
