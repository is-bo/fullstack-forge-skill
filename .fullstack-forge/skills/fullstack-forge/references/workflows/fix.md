# Fix workflow

Load this reference for explicit remediation of findings. Ordinary authored implementation work uses
the [safe-fix policy](../SAFE_FIX_POLICY.md) without loading this full finding lifecycle.

1. Load the original finding and preserve its evidence and stable identifier.
2. Confirm authorization, scope, current content, target hashes, affected paths, expected edits,
   verification, and rollback procedure.
3. Apply only a registered bounded fix whose preconditions still match. Reject symlinks, traversal,
   post-audit changes, broad replacement, or unsupported shapes.
4. Review the diff adversarially for scope, compatibility, security, and data loss.
5. Reproduce the original issue, run finding-specific verification, and then run relevant regression
   gates after the final edit.
6. Append verification evidence without rewriting the original observation. Preserve failures and
   keep unavailable checks `NOT_VERIFIED` or `BLOCKED`.

`--safe` never authorizes architecture, product, identity, financial, tenant, data, infrastructure,
or public-contract decisions.
