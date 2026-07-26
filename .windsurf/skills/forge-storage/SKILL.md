---
name: forge-storage
description: Inspect object naming, access control, encryption, lifecycle, consistency, integrity, and recovery. Activate automatically for object stores, file systems, blob databases, and cdn-backed assets when that concern is relevant to a software-engineering request.
---

# forge-storage: Object and file storage

## Purpose

Inspect object naming, access control, encryption, lifecycle, consistency, integrity, and recovery.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves object and file storage, when
the user explicitly names `forge-storage`, or when discovery proves an applicable boundary.

- Object stores, file systems, blob databases, and CDN-backed assets

## When not to activate

- No persistent files or objects

## Automated support

Relevant discovery inputs are:

- storage clients
- bucket and CDN configuration
- object references

Available deterministic support, where present:

- Use `inspect-upload-pipeline` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Inventory storage destinations (buckets, filesystems, database blobs) with their access policies and encryption settings.
2. Verify private-by-default access and trace every public exposure to an explicit recorded decision.
3. Check signed-URL generation for prior authorization, scope, and expiry, and object keys for server generation and tenant separation.
4. Trace lifecycle: replacement, orphan detection, account and tenant deletion, retention, and backup inclusion for stored objects.
5. Verify environment separation and quota or growth controls.

Manual inspection requirements:

- Review actual bucket, key, network, replication, and lifecycle policy
- Test provider consistency and failure assumptions

Stack-specific guidance:

- Treat presigned URLs as scoped credentials and bind method, object, size, and expiry

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add integrity validation and explicit content headers
- Add cleanup for proven temporary-object leaks

## Approval-required changes

- Changing visibility, retention, replication, or deleting objects

## Verification

- Exercise unauthorized and cross-tenant object access
- Verify lifecycle and restore behavior with recorded provider output

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Repository configuration does not prove deployed bucket policy
