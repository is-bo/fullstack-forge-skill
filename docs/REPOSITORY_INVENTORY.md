# Repository inventory

Fullstack Forge uses one bounded inventory for project discovery, capability selection, static
inspection, secret scanning, and working-tree identity. Generated output and binaries no longer
consume the relevant-text budget before classification.

## Candidate discovery

Inside a Git worktree, Forge runs Git directly—never through a shell—with NUL-separated output
equivalent to:

```text
git ls-files -z --cached --others --exclude-standard -- .
```

This includes tracked files and untracked non-ignored files under the selected root while honoring
`.gitignore`, `.git/info/exclude`, and configured global ignores. Paths are validated, sorted
deterministically, contained inside the selected root, and never followed through symlinks. If Git
is unavailable or the root is not in a worktree, a deterministic walker applies entry, depth, and
symlink bounds. The profile records `source: "fallback"` and the Git failure.

Choose the narrowest correct monorepo root. A nested workspace root limits candidates to that
workspace; repository-wide policy review should use the repository root.

## Default exclusions

The shared policy excludes directories whose contents are not application-source evidence:

| Category            | Names                                                                                    | Rationale                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Forge-private state | `.git`, `.forge`, `.fullstack-forge`, `.audit`, `.audit-work`, `.codex`                  | Version-control internals, local reports, ownership data, research, and attachments must not re-enter evidence or packages.      |
| Dependencies        | `node_modules`, `vendor`                                                                 | Third-party trees are assessed through manifests and lockfiles, not as application source.                                       |
| Generated output    | `.next`, `.nuxt`, `.output`, `.svelte-kit`, `build`, `coverage`, `dist`, `out`, `target` | Build products are neutral evidence and can be arbitrarily large. A tracked path is recorded before neutralization.              |
| Framework caches    | `.cache`, `.turbo`, `.tox`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache` | Regenerable caches are not implementation evidence.                                                                              |
| Local environments  | `.venv`, `venv`, `env`, `.gradle`, `.idea`, `.vscode`                                    | Local dependency and editor state is not application source.                                                                     |
| Runtime data        | `uploads`, `attachments`, `backups`, `logs`                                              | Clearly private, untracked top-level runtime files are excluded without reading them. Tracked or nested source remains evidence. |
| Temporary data      | `.tmp`, `temp`                                                                           | Ephemeral files are not durable source evidence.                                                                                 |

Forge does not exclude every unknown directory. Documentation, tests, examples, and fixtures are
classified as neutral and sampled only within a small representative bound; they cannot activate a
production capability. Generic output names such as `build`, `dist`, `out`, and `target` are
automatic exclusions only at the selected root, so application source such as `src/build/` remains
eligible.

Runtime-looking directory names are handled more narrowly. A tracked `uploads/handler.ts`,
`src/logs/logger.ts`, `apps/api/attachments/service.ts`, or `packages/backups/processor.ts` is
inspected as ordinary source. An untracked nested source path is also inspected. Only a clearly
private top-level runtime file such as `uploads/private.sqlite` can be skipped automatically. A
top-level untracked runtime-looking text/source file is not read merely to classify the directory:
the inventory is marked `PARTIAL`, emits `FF-INVENTORY-001` as `NOT_VERIFIED`, and Audit, Verify,
and Ship exit `2`.

Known images, audio/video, archives, executables, compiled objects, databases, fonts, source maps,
and other binary formats are skipped before the text budget. Unknown formats receive a bounded
binary probe. Oversized relevant files are recorded as skipped; they are never called inspected.

## `.forgeignore` and `--exclude`

`.forgeignore` is read from the selected root. It supports blank lines, `#` comments, `*`, `**`,
`?`, directory names, spaces, Unicode, and `/` or Windows `\` separators. Patterns must be
repository-relative. Absolute, drive-qualified, traversal, control-character, ADS, and negation
patterns are rejected.

CLI exclusions are repeatable:

```powershell
forge audit all --exclude .next --exclude storage\local
forge security audit --exclude test-data --json
forge ship --exclude generated
```

```bash
forge all audit --exclude .next --exclude storage/local
```

Exclusions are a limitation, not proof that a capability is absent. If a user pattern removes
potential required evidence, the profile is `PARTIAL`, affected checks remain `NOT_VERIFIED`, and
Audit, Verify, or Ship exits `2`.

## Budgets and diagnostics

The default relevant-text budget is 128 MiB, the per-file limit is 2 MiB, the inventory limit is
100,000 candidates, and directory depth is limited to 64. The text budget counts bytes actually read
after path, metadata, extension, relevance, and binary checks—not every file size encountered.

An explicit override is strictly parsed and capped at 512 MiB:

```bash
forge all audit --inspection-budget 192MiB
forge security audit --inspection-budget 67108864 --json
```

Review contributors before increasing a budget. The JSON profile and report environment record the
selected budget, exclusions, candidate and inspected counts, skipped files, bytes considered and
read, binary/ignored/generated exclusions, largest files/directories, affected modules, and next
actions.

Budget exhaustion preserves collected evidence and returns:

- inventory `status: "PARTIAL"` with a reason such as `inspection-budget-exhausted`;
- finding `FF-INVENTORY-001` at `NOT_VERIFIED`;
- exit code `2`, unless a proven defect already requires exit code `1`;
- no generic scanner exception and no false `PASS`.

Working-tree revisions use the same inventory. Clean Git trees retain `git:<commit>`. Dirty relevant
text is content-hashed without exposing content. A skipped dirty binary or incomplete inventory is
identified as `dirty-partial`; it cannot be mistaken for a complete clean revision.

## Agent workflow

An Agent Skill should first establish the exact root, inspect Git status and manifests, use bounded
inventory evidence, identify workspaces/capabilities, and then select modules or a narrower CLI
scope. It must preserve CLI statuses, never simulate deterministic evidence, and report an
incomplete inventory as `NOT_VERIFIED` with `.forgeignore`, `--exclude`, narrower-root, or reviewed
budget guidance.
