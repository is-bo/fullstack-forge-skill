# Fullstack Forge v0.1.0 release verification

Recorded on 2026-07-18 after the corrective `v0.1.0` publication. This record keeps source,
workflow, archive, and installation evidence separate; it does not infer production or provider
state from a local check.

## Published identity

- Repository: <https://github.com/thethunderbolt/fullstack-forge-skill>
- Release: <https://github.com/thethunderbolt/fullstack-forge-skill/releases/tag/v0.1.0>
- Annotated tag object: `554041cc742bcb13be0c2b543a281a2d8c692492`
- Peeled release commit:
  [`dda494c062296481c5c2669b929b40c84789f02f`](https://github.com/thethunderbolt/fullstack-forge-skill/commit/dda494c062296481c5c2669b929b40c84789f02f)
- Linux and Windows CI:
  [run 29650035711](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29650035711)
- Tagged release build:
  [run 29650260667](https://github.com/thethunderbolt/fullstack-forge-skill/actions/runs/29650260667)

Both workflow runs completed successfully. The tag was then resolved again from the public remote
and independently cloned at the peeled commit above.

## Source gate

The fresh public tag clone passed `npm run check` with:

- formatting, ESLint, TypeScript type checking, and all 36 tests;
- 43 canonical skills and six synchronized generated platform roots;
- all 42 modules and all 957 explicit inspection criteria;
- 394 Markdown files and 121 checked references;
- 91 development dependencies with allowed licenses;
- three dimension- and size-validated original branding assets;
- 573 files scanned with zero secret-pattern findings; and
- `npm audit` reporting zero vulnerabilities.

Regeneration during the gate left no tracked changes in the tag clone.

## Release assets

The release contains exactly nine ZIP archives, `manifest.json`, and `SHA256SUMS.txt`. All 11
downloaded files matched the SHA-256 digests reported by GitHub. The distribution validator then
confirmed:

- version `0.1.0`, nine archives, and 987 total entries;
- complete checksum and manifest agreement;
- deterministic stored-file metadata, payload CRCs, regular files, and unique safe paths;
- required README, license, notice, and master-skill files in every archive; and
- no symlink, traversal, repository metadata, dependency tree, temporary file, or private
  requirements-document entry.

An independent semantic pass checked all 588 command-skill copies across the archives. Every copy
contained its module's complete criteria list. Exact payload and title comparisons found no copy of
the private local requirements document.

## Public installation

The package was installed directly from the public `v0.1.0` tag with lifecycle scripts disabled. The
installed package contained 486 files and reported:

- CLI version `0.1.0`;
- 42 modules and 24 bounded tools;
- 43 valid bundled skills with no validation errors; and
- an 11-file deterministic package plan.

Fresh isolated roots for generic Agent Skills, Codex, Antigravity, Claude Code, Cursor, Gemini CLI,
GitHub Copilot, and Windsurf each installed 43 skills, completed an idempotent update, returned five
`doctor` checks as `PASS`, and contained no symlink or reparse point. Every installed platform copy
was checked again for all 42 modules and 957 criteria.

## Manual repository presentation step

The social-preview artwork is prepared at
[`docs/assets/fullstack-forge-social-preview.png`](assets/fullstack-forge-social-preview.png). A
repository administrator must upload it through
`Settings → General → Social preview → Edit → Upload image`. This manual presentation step does not
alter the verified tag, release assets, checksums, or installation behavior.
