# Fix and verify findings

Start with a preview. This command does not edit files:

```bash
npx forge fix
```

Forge shows only fixes in its bounded safe registry, including the files and intended effects. Apply
the reviewed safe plan explicitly:

```bash
npx forge fix --safe
```

Identity, authorization, tenant policy, payments, data, migrations, secrets, legal behavior,
production infrastructure, and destructive changes are never implied by `--safe`. Unsupported or
risky findings remain approval-bound.

Inspect the diff, then re-run finding-specific proof:

```bash
npx forge verify
```

Verification preserves the original evidence and identifies resolved, failing, blocked, stale, and
not-verified results separately. If the audited file changed after the report, the safe-fix engine
refuses to overwrite it. When the working-tree revision changed, prior findings that were not
directly rechecked become `NOT_VERIFIED` instead of being rebound to the new revision; Verify exits
2 until that evidence is collected. Re-audit to establish a current evidence snapshot.
