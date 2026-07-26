---
name: forge-uploads
description: Audit the complete upload, processing, storage, delivery, and deletion pipeline against hostile files. Activate automatically for direct or presigned uploads when that concern is relevant to a software-engineering request.
---

# forge-uploads: File uploads

## Purpose

Audit the complete upload, processing, storage, delivery, and deletion pipeline against hostile files.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves file uploads, when
the user explicitly names `forge-uploads`, or when discovery proves an applicable boundary.

- Direct or presigned uploads
- Imports, attachments, avatars, media, and generated files

## When not to activate

- Systems with no file ingestion or user-controlled object references

## Automated support

Relevant discovery inputs are:

- upload routes
- storage configuration
- processors and download paths

Available deterministic support, where present:

- Use `inspect-upload-pipeline` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Map the complete pipeline: entry points, validation layers, processing steps, storage destinations, and delivery paths.
2. Verify server-side validation order: authorization, then count and byte limits, then decoded content and signature checks — never extension or client MIME alone.
3. Trace where bytes rest at each stage; verify private-by-default quarantine before scanning and that scanner errors or timeouts fail closed.
4. Inspect object keys (server-generated, unguessable), tenant separation, signed-URL scope and expiry, and delivery headers (Content-Disposition, fixed Content-Type, nosniff).
5. Exercise hostile inputs where a fixture suite exists: polyglots, oversized files, archive bombs, and traversal names; verify cleanup of temporary, abandoned, and replaced objects.

Manual inspection requirements:

- Review provider bucket policy and malware-scanner failure mode
- Exercise polyglot, oversized, malformed, duplicate, and unauthorized objects

Stack-specific guidance:

- Do not trust client MIME or original filenames; validate after streaming limits

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- OWASP File Upload Cheat Sheet
- OWASP ASVS 5.0

## Common production failures

- Trace authorization, filename normalization, extension and MIME allowlists, signature detection, size and count limits
- Inspect archive bombs, path traversal, parser isolation, malware scanning, image re-encoding, metadata stripping, and quarantine
- Verify private storage, random object names, signed URL scope/expiry, download headers, tenant boundaries, cleanup, and orphan handling

## Missing-control checks

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

## Commands and tools

- Run `forge uploads audit --json` or `fullstack-forge uploads audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Add explicit size/count limits and safe content-disposition
- Normalize generated object names and log redaction

## Approval-required changes

- Changing bucket visibility, accepted types, retention, or processing architecture

## Verification

- Run a hostile-file fixture suite through the real pipeline
- Confirm rejected and quarantined files are neither served nor orphaned

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Scanner effectiveness and storage policy need direct service evidence
