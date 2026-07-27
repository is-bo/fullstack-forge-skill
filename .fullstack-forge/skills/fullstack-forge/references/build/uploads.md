# Build brief: File uploads

## Decide before coding

- Decide the fail-closed behavior for malware scanning and quarantine before any accepted file is stored or served: an unscanned or scan-failed file stays quarantined, never released.
- Decide that uploaded objects are stored private-by-default with server-generated keys; the original filename and client-supplied path are never trusted as a storage location.
- Decide validation happens on magic bytes and streamed content, not the client-supplied extension or MIME type, before any file reaches a parser or storage.
- Decide explicit size limits, file-count limits, and decompressed-size limits for this upload path before it accepts its first file, to block archive and decompression bombs.
- Decide how a rejected or quarantined file is surfaced to the user and cleaned up, so it never becomes an orphaned or silently-served object.

## Evidence to produce while building

- A hostile-file fixture suite (oversized, wrong-signature, archive bomb, polyglot, malformed) run through the real pipeline, confirming each is rejected or quarantined.
- A test showing a scanner failure or timeout keeps the file quarantined rather than defaulting to available.
- Confirmation that stored object keys are server-generated and unguessable, with the original filename never used as a path.
- A test showing enforced size, count, and decompressed-size limits reject an oversized or bomb-shaped upload before it is fully processed.
- Confirmation that rejected and quarantined files are neither publicly reachable nor left as orphaned storage.
