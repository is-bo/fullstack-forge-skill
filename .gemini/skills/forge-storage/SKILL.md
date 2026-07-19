---
name: forge-storage
description: Inspect object naming, access control, encryption, lifecycle, consistency, integrity, and recovery. Use for object stores, file systems, blob databases, and cdn-backed assets.
---

# forge-storage: Object and file storage

## Purpose

Inspect object naming, access control, encryption, lifecycle, consistency, integrity, and recovery.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-storage`, asks about object and file storage, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Object stores, file systems, blob databases, and CDN-backed assets

## When it does not apply

- No persistent files or objects

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- storage clients
- bucket and CDN configuration
- object references

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

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

### Concrete checks

- Trace create, read, replace, copy, list, and delete authorization
- Inspect private-by-default policy, object naming, tenant prefixes, signed URL constraints, encryption, checksums, versioning, and lifecycle
- Check orphan cleanup, partial writes, metadata leakage, CDN caching, legal holds, and restore expectations

## Required inspection criteria

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

## Safe executable checks

- Run `forge storage audit --json` or `fullstack-forge storage audit --json` when
  the CLI is installed.
- Use `inspect-upload-pipeline` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review actual bucket, key, network, replication, and lifecycle policy
- Test provider consistency and failure assumptions

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-STOR-001`, `FF-STOR-002`, and so on. Preserve an ID across
verification and report formats.

- `CRITICAL`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- `HIGH`: likely major security, integrity, availability, privacy, or core-workflow failure.
- `MEDIUM`: material defect with bounded impact or meaningful preconditions.
- `LOW`: localized robustness, maintainability, or user-impact defect.
- `INFO`: verified context or improvement with no current defect.

Confidence is `HIGH` for reproduced behavior or direct executable evidence, `MEDIUM` for a
complete static trace, and `LOW` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

- Add integrity validation and explicit content headers
- Add cleanup for proven temporary-object leaks

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing visibility, retention, replication, or deleting objects

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Exercise unauthorized and cross-tenant object access
- Verify lifecycle and restore behavior with recorded provider output

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- OWASP ASVS 5.0
- CIS storage-service guidance

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Treat presigned URLs as scoped credentials and bind method, object, size, and expiry

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Repository configuration does not prove deployed bucket policy

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.
