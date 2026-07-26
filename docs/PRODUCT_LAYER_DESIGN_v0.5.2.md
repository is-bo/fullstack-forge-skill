# Product layer design — v0.5.2

## Shared inventory boundary

One deterministic inventory now supplies discovery, capability assessment, analyzers, inspectors,
secret scanning, Ship rediscovery, and working-tree identity:

```text
selected root
  -> Git NUL candidate list or bounded fallback
  -> path containment and no-link policy
  -> default / .forgeignore / --exclude classification
  -> metadata, extension, relevance, bounded binary probe
  -> bounded relevant-text content
  -> COMPLETE or PARTIAL diagnostics
  -> profile, modules, findings, revision, Ship
```

The inventory separates entry, depth, per-file, relevant-text, binary-probe, and Git-output bounds.
Skipped content carries a reason. Neutral test, documentation, fixture, example, and generated
material cannot activate production capabilities.

## Evidence contract

`COMPLETE` permits normal downstream evaluation. `PARTIAL` preserves every inspected record and adds
`FF-INVENTORY-001` at `NOT_VERIFIED`. Audit, Verify, and Ship exit `2` unless a proven failure
already requires `1`. User exclusions are visible limitations, never positive evidence.

The CLI adds repeatable `--exclude` and strict `--inspection-budget`; reports record both. Older
profiles and reports remain readable because additions are optional under the existing schema
versions.

## Agent contract

Canonical skills establish the exact root, Git status, manifests, bounded inventory, workspaces, and
capabilities before selecting modules. Agents preserve CLI states and never simulate a deterministic
pass.
