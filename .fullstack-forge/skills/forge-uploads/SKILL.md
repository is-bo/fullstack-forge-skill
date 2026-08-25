---
name: forge-uploads
description: "Audit the complete upload, processing, storage, delivery, and deletion pipeline against hostile files."
---

# forge-uploads: File uploads

Engine: Forge native

## Purpose

Audit the complete upload, processing, storage, delivery, and deletion pipeline against hostile files.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" uploads compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

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

Deterministic support, bounded evidence only:

- `inspect-upload-pipeline`

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

Standards used as criteria:

- OWASP File Upload Cheat Sheet
- OWASP ASVS 5.0

## Common production failures

- Trace authorization, filename normalization, extension and MIME allowlists, signature detection, size and count limits
- Inspect archive bombs, path traversal, parser isolation, malware scanning, image re-encoding, metadata stripping, and quarantine
- Verify private storage, random object names, signed URL scope/expiry, download headers, tenant boundaries, cleanup, and orphan handling

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Add explicit size/count limits and safe content-disposition
- Normalize generated object names and log redaction

## Approval-required changes

- Changing bucket visibility, accepted types, retention, or processing architecture

## Verification

- Run a hostile-file fixture suite through the real pipeline
- Confirm rejected and quarantined files are neither served nor orphaned

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Scanner effectiveness and storage policy need direct service evidence
