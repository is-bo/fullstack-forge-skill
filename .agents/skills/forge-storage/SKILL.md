---
name: forge-storage
description: Inspect object naming, access control, encryption, lifecycle, consistency, integrity, and recovery. Activate automatically for object stores, file systems, blob databases, and cdn-backed assets when that concern is relevant to a software-engineering request.
---

# forge-storage: Object and file storage

## Purpose

Inspect object naming, access control, encryption, lifecycle, consistency, integrity, and recovery.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves object and file storage, when
the user explicitly names `forge-storage`, or when discovery proves an applicable boundary.

- Object stores, file systems, blob databases, and CDN-backed assets

## When not to activate

- No persistent files or objects

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- storage clients
- bucket and CDN configuration
- object references

Available deterministic support, where present:

- Use `inspect-upload-pipeline` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory storage destinations (buckets, filesystems, database blobs) with their access policies and encryption settings.
3. Verify private-by-default access and trace every public exposure to an explicit recorded decision.
4. Check signed-URL generation for prior authorization, scope, and expiry, and object keys for server generation and tenant separation.
5. Trace lifecycle: replacement, orphan detection, account and tenant deletion, retention, and backup inclusion for stored objects.
6. Verify environment separation and quota or growth controls.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review actual bucket, key, network, replication, and lifecycle policy
- Test provider consistency and failure assumptions

Stack-specific guidance:

- Treat presigned URLs as scoped credentials and bind method, object, size, and expiry

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

Primary standards used as criteria, not proof of compliance:

- OWASP ASVS 5.0
- CIS storage-service guidance

## Common production failures

- Trace create, read, replace, copy, list, and delete authorization
- Inspect private-by-default policy, object naming, tenant prefixes, signed URL constraints, encryption, checksums, versioning, and lifecycle
- Check orphan cleanup, partial writes, metadata leakage, CDN caching, legal holds, and restore expectations

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Files stored as database blobs
- Object-storage configuration
- Public versus private files
- Signed URLs
- Authorization
- Metadata
- CDN configuration
- File lifecycle
- Orphaned objects
- Deletion
- Backups
- Encryption
- Temporary files
- Retention
- Storage quotas
- Environment isolation

## Commands and tools

- Run `forge storage audit --json` or `fullstack-forge storage audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use `inspect-upload-pipeline` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Add integrity validation and explicit content headers
- Add cleanup for proven temporary-object leaks

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing visibility, retention, replication, or deleting objects

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Exercise unauthorized and cross-tenant object access
- Verify lifecycle and restore behavior with recorded provider output

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Repository configuration does not prove deployed bucket policy

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
