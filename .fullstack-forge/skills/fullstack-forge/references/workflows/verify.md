# Verify workflow

Load this reference when retesting existing findings or claims.

1. Revalidate repository root, revision, finding identity, producer contract, expiry, inputs, and
   artifact hashes before using prior evidence.
2. Re-run the original reproduction and the finding-specific verification procedure.
3. Record the exact command or runtime observation and append it to the finding lifecycle.
4. Mark a resolution only from affirmative current evidence. Changed, stale, missing, or unsupported
   proof remains `NOT_VERIFIED` or `BLOCKED`; a continuing defect remains `FAIL`.
5. Run directly relevant regression gates after the final edit and report every skipped check.

Verification never erases the initial observation or silently rebinds old positive evidence to a new
revision.
