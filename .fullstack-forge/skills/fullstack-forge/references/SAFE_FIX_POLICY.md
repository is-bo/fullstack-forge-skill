# Safe-fix policy

## Safe only when bounded and verified

Formatting, proven lint or type corrections, accessible labels, straightforward security headers,
input limits, log redaction, pagination bounds, dead-code removal proven by references, missing test
assertions, and evidence-backed documentation corrections may be safe.

The change must be local, reversible, compatible with established behavior, and covered by an
explicit verification. Automatic execution additionally requires a typed registry entry, a confirmed
prior finding, current evidence, an exact expected hash, parser-backed or structural validation,
repository-contained regular-file paths, a dry-run plan, and rollback information. Refuse a changed
target, symlink, path traversal, unregistered shape, or broad replacement. Inspect the diff and run
gates after the final edit.

## Approval required

Require explicit approval or an already-authorized risky-change flag before:

- replacing authentication or changing identity linkage;
- changing role, ownership, tenant, or public API semantics;
- editing applied production migrations, dropping schema, deleting data, or deleting user files;
- introducing Redis, queues, microservices, or a new infrastructure boundary;
- changing financial calculations, prices, ledgers, or entitlements;
- rotating secrets, deploying, or changing production infrastructure;
- making private data public, weakening a control, or expanding AI tool authority.

Resolve exact targets and inspect current state first. Prefer a dry run or reversible variant. Never
use a broad delete, wildcard, unresolved path, or history rewrite to repair generated output.
