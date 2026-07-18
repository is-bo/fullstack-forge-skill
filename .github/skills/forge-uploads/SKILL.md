---
name: forge-uploads
description: Audit the complete upload, processing, storage, delivery, and deletion pipeline against hostile files. Use for direct or presigned uploads.
---

# forge-uploads: File uploads

## Purpose

Audit the complete upload, processing, storage, delivery, and deletion pipeline against hostile files.

Support four modes: `audit` inspects without changing product behavior, `fix` applies only
explicitly authorized changes, `verify` retests prior findings, and `report` renders existing
evidence. If no mode is supplied, use `audit`.

## Trigger conditions

Use this module when a request names `forge-uploads`, asks about file uploads, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

- Direct or presigned uploads
- Imports, attachments, avatars, media, and generated files

## When it does not apply

- Systems with no file ingestion or user-controlled object references

Do not silently skip it. Emit a `NOT_APPLICABLE` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

- upload routes
- storage configuration
- processors and download paths

Prefer `.forge/project-profile.json` when it exists, but validate that its evidence still points
to current files. Read `../fullstack-forge/references/PROTOCOL.md` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything.
2. State an applicability decision and the evidence supporting it.
3. Trace at least one critical flow end to end; do not infer downstream enforcement from a UI or
   declaration alone.
4. Run the safe executable checks below. Capture command, exit code, relevant output, and time.
5. Perform the manual inspections. Mark unavailable runtime or operator evidence `NOT_VERIFIED`.
6. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location.
7. In `fix` mode, separate safe fixes from approval-required changes before editing.
8. In `verify` mode, reproduce the original condition, run the stated verification, and update
   status without erasing earlier evidence.

### Concrete checks

- Trace authorization, filename normalization, extension and MIME allowlists, signature detection, size and count limits
- Inspect archive bombs, path traversal, parser isolation, malware scanning, image re-encoding, metadata stripping, and quarantine
- Verify private storage, random object names, signed URL scope/expiry, download headers, tenant boundaries, cleanup, and orphan handling

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Server-side extension allowlists
- Browser accept attributes as hints rather than proof
- MIME validation
- Magic-byte validation
- File-signature validation
- Extension and MIME mismatches
- File-count limits
- Per-file size limits
- Total request limits
- Decompressed-size limits
- Image dimensions
- Image pixel counts
- PDF page counts
- Archive entry limits
- Parser bombs
- ZIP bombs
- Decompression bombs
- Malformed documents
- Polyglot files
- Quarantine storage
- Malware scanning before release
- Scanner timeout behavior
- Scanner failure behavior that fails closed
- Scanner metadata
- File hashes
- Rescanning policy
- Malware alerts
- Permanent quarantine
- Deletion policy
- Administrative handling
- No untrusted files in executable directories or public application folders
- Server-generated object keys
- Original filenames never used as paths
- Private-by-default object storage
- Short-lived signed URLs
- Tenant and environment separation
- Authorization before signed-URL generation
- Unguessable object identifiers
- Public-indexing prevention
- Active-content rendering prevention
- Image decode and re-encode
- EXIF stripping
- Image dimension and pixel limits
- Safe thumbnails
- SVG sanitization or rejection
- Remote SVG reference prevention
- Embedded script prevention
- PDF JavaScript
- PDF embedded files
- PDF launch actions
- Document external references
- Interactive forms
- Macros and Office active content
- Sandboxed parsers and parser resource limits
- Safe preview generation
- Document normalization
- Hostile extracted text
- No execution of embedded content
- Filename normalization
- Unicode trick detection
- Control characters
- Path traversal
- Safe Content-Disposition
- Fixed Content-Type and X-Content-Type-Options nosniff
- No reflected filenames in HTML
- Unsafe formats not rendered inline
- Per-user, per-IP, and per-tenant limits
- Storage quotas
- Concurrent-upload limits
- Repeated processing attacks
- Many-small-files attacks
- Resource timeouts
- Parser isolation
- Monitoring and cleanup
- Temporary-file and abandoned-upload cleanup
- Orphan detection and replacement cleanup
- Account and tenant deletion
- Retention and backup behavior
- Log and signed-URL redaction
- Encryption

## Safe executable checks

- Run `forge uploads audit --json` or `fullstack-forge uploads audit --json` when
  the CLI is installed.
- Use `inspect-upload-pipeline` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

- Review provider bucket policy and malware-scanner failure mode
- Exercise polyglot, oversized, malformed, duplicate, and unauthorized objects

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for missing production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs `FF-UPLO-001`, `FF-UPLO-002`, and so on. Preserve an ID across
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

- Add explicit size/count limits and safe content-disposition
- Normalize generated object names and log redaction

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Risky changes requiring approval

- Changing bucket visibility, accepted types, retention, or processing architecture

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

- Run a hostile-file fixture suite through the real pipeline
- Confirm rejected and quarantined files are neither served nor orphaned

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Report fields

Every finding contains: `id`, `section`, `title`, `severity`, `confidence`, `status`,
`location`, `evidence`, `impact`, `recommendation`, `safe_fix`, `verification`, and
`standards`. Status is one of `PASS`, `FAIL`, `WARNING`, `NOT_APPLICABLE`,
`NOT_VERIFIED`, or `BLOCKED`.

## Primary standards

- OWASP File Upload Cheat Sheet
- OWASP ASVS 5.0

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

- Do not trust client MIME or original filenames; validate after streaming limits

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

- Scanner effectiveness and storage policy need direct service evidence

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
