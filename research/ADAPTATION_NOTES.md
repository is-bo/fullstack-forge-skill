# Adaptation notes

## Adopted concepts

- Open Agent Skills naming, frontmatter, progressive disclosure, and self-contained skill folders.
- A canonical source plus platform registry and deterministic generated copies.
- Small specialist scopes that can be selected automatically or invoked explicitly.
- Data-informed UI/UX priority: accessibility, responsive behavior, visible states, and restrained
  professional presentation before decorative effects.
- Domain-focused security, database, authentication, and cache modules.

## Original implementation decisions

- One strict finding schema with affirmative PASS evidence and explicit `NOT_VERIFIED`.
- The same completion contract embedded in every command skill.
- Consumer and generator ownership manifests with hash-based conflict preservation.
- No-symlink, path-contained installation and exact-file uninstall.
- Project command execution behind displayed definitions and explicit `--allow-run`.
- Deterministic ZIP writer with sorted entries and fixed timestamps.
- A single catalog that generates 42 substantial, individually copyable skills.
- Full platform formats updated from current primary documentation rather than inherited from older
  reference-repository templates.

## Rejected patterns

- Broad uninstall of every known skill directory without ownership proof.
- Hand-maintained platform copies.
- Legacy `.codex/skills` as the primary current Codex repository path.
- Symlinks between platform directories.
- Thin modules that merely recommend “best practices.”
- Treating scanner silence, written intent, or an unavailable runtime as PASS.
- Copying third-party audit prose, data tables, branding, or implementation code.
