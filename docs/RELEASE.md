# Release process

1. Confirm the version in `package.json`, `skill.json`, CLI constants, changelog, and smoke
   expectations.
2. Run focused tests for the final changes.
3. Run the complete required local validation matrix and `npm run check` on the complete
   implementation.
4. Generate and inspect branding dimensions, research attribution, licenses, documentation, and
   platform paths.
5. Run `npm run package:platforms` twice and confirm archive and checksum bytes are identical.
6. Run `npm run smoke:install` and inspect `npm pack --json` for private/local files.
7. Make final fixes, then run `npm run check` again after the last edit.
8. Verify the local specification and temporary research are untracked and absent from npm and ZIP
   contents.
9. Commit with conventional subjects, merge through a reviewed pull request, and wait for Linux,
   Windows, macOS, dependency-review, and CodeQL results on `main`.
10. Create the next annotated tag from the verified commit without moving any prior tag. The release
    workflow must prove that no release exists, create a draft without clobbering, upload and attest
    deterministic archives, verify downloaded bytes and checksums, attach checksummed final
    evidence, publish once, and verify the resulting immutable release.

Repository description, topics, and social preview must be set to match the release. If the hosting
API cannot set a social preview, record that exact human-only step rather than claiming completion.

Never publish after a failed local or remote gate, open required critical/high finding, incomplete
attribution, out-of-sync generated copy, missing archive, or failed clean installation.
