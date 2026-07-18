# Adding a platform

A platform is supported only after its current first-party documentation, project path, global path,
skill format, invocation convention, and limitations have been verified and recorded in
`docs/PLATFORM_SUPPORT.md` and `research/SOURCES.md`.

## Implementation

1. Add the canonical target identifier, label, and repository path to `scripts/project.mjs`.
2. Add the installer alias and local/global path to `cli/src/constants.ts`. Reuse a shared target
   when two agents officially scan the same directory; do not duplicate writes.
3. Add the platform to `skill.json`, README support tables, package metadata, and CLI help.
4. Add a deterministic archive definition in `scripts/package-platforms.mjs` only when that package
   has a distinct useful layout.
5. Run `npm run generate`. The synchronizer must create a SHA-256 ownership manifest and refuse
   unknown or modified managed files.

Never invent a vendor directory from naming intuition. Platform content remains a generated copy of
`src/fullstack-forge/`; vendor-specific metadata belongs in canonical optional resources such as
`agents/openai.yaml`, not in hand-edited forks.

## Verification

- Test aliases, local and global destinations, `--dry-run`, JSON output, conflicts, idempotent
  update, modified-file preservation, clean uninstall, traversal, symlinks, and platform-specific
  paths.
- Run the test matrix on Linux and Windows; exercise macOS path logic where practical.
- Run synchronization twice and prove byte equality with canonical content and manifests.
- Validate the new archive, checksum, license files, npm contents, and a temporary offline install.
- After publication, install from the release in a clean directory and record the result in the
  versioned release-verification document.

If official behavior is uncertain, document the platform as investigated but unsupported rather than
shipping a guessed path.
