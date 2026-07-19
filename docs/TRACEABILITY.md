# Specification traceability

Fullstack Forge is built against an authoritative specification that is **not** part of this
repository and is never published. This document explains how the project proves, in public, that
every authoritative requirement is accounted for — without disclosing the source text.

The published result is [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md).

## What the matrix is

A matrix entry restates one authoritative requirement in the maintainers' own words and links it to
evidence that a reader can open:

| Field                  | Meaning                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `id`                   | Stable, independent identifier (`FF-<AREA>-<NN>`). It never changes meaning. |
| `summary`              | An original one-sentence restatement written by the maintainers.             |
| `implementation`       | Repository paths that implement the requirement.                             |
| `tests`                | Repository paths that exercise it.                                           |
| `documentation`        | Repository paths that explain it to users or contributors.                   |
| `release_verification` | Where the requirement was checked during a release.                          |
| `status`               | One of the allowed statuses below.                                           |
| `verification_scope`   | Why a `NOT_VERIFIED` entry cannot be settled here.                           |
| `pending_integration`  | Integration placeholders for work landing on a parallel branch.              |
| `limitations`          | Honest statements of what is not proven.                                     |

### Allowed statuses

- `COMPLIANT` — implemented, with test or documentation evidence.
- `PARTIALLY_COMPLIANT` — implemented within stated bounds; the bounds are in `limitations`.
- `NON_COMPLIANT` — not satisfied. Requires a stated reason.
- `NOT_VERIFIED` — cannot be confirmed from this repository. Requires a `verification_scope`.
- `NOT_APPLICABLE` — out of scope for this project. Requires a stated reason.

### Distinguishing external limits from unfinished work

`NOT_VERIFIED` is ambiguous unless it says _why_, so `verification_scope` is mandatory:

- `external` — the fact lives outside the repository (a hosting provider's setting, a third-party
  dashboard, how a page finally renders on another site). No amount of local work resolves it; a
  maintainer records the check out of band.
- `pending-integration` — the work exists but is being developed on a parallel branch and is not in
  this tree yet. These entries must carry at least one integration placeholder.

An `external` entry may not carry integration placeholders, and a `pending-integration` entry may
not pretend to be an external limit. The validator enforces both directions.

## Private-specification protection

The authoritative specification is untracked, excluded from formatting, and excluded from every
published package. The matrix protects it by construction:

- Requirement summaries are **original wording**. Source text is never quoted or paraphrased closely
  enough to reconstruct it.
- No requirement carries a source section number, heading, or ordering that mirrors the
  specification's internal structure; identifiers are grouped by engineering area instead.
- No private example, sample value, or internal instruction is reproduced.
- Nothing in the matrix or in this document reveals specification content that is not already
  publicly documented elsewhere in the repository.

If you are adding an entry, write what the project must do, not what the source says.

## Integration placeholders

Versions 0.1.7 through 0.1.10 are being implemented on parallel branches, so some requirements are
only partly satisfied in any single branch. Those entries record a placeholder instead of inventing
evidence:

```text
integration:v0.1.7
integration:v0.1.8
integration:v0.1.9
```

Rules the validator enforces:

- A placeholder must match `integration:vMAJOR.MINOR.PATCH`.
- A requirement carrying a placeholder may **not** be `COMPLIANT`.
- A requirement carrying a placeholder must state a limitation explaining what is missing.
- Placeholders live only in `pending_integration`, never in an evidence field.

### How the integration agent resolves them

For each requirement with a `pending_integration` entry:

1. Confirm which branch actually delivered the behaviour. The placeholder version is the
   maintainers' provisional attribution, not a guarantee; correct it if the work landed elsewhere.
2. Replace the placeholder by adding the real implementation and test paths to the `implementation`
   and `tests` arrays.
3. Remove the placeholder from `pending_integration`.
4. Rewrite the corresponding `limitations` entry: delete the sentence about parallel-branch work,
   and keep only limitations that remain true after integration.
5. Raise `status` to `COMPLIANT` only when implementation evidence plus test or documentation
   evidence both exist.
6. Run `npm run generate:traceability` and commit the regenerated Markdown.

A branch is fully integrated for traceability purposes when `npm run check:traceability` reports
`integration_placeholders: []`.

## Maintaining the matrix

`config/traceability-matrix.json` is the single source of truth. `docs/TRACEABILITY_MATRIX.md` is
generated from it.

```bash
npm run generate:traceability   # regenerate the published Markdown
npm run check:traceability      # validate the matrix and confirm the Markdown is in sync
```

`npm run check` runs the validation step, so CI fails on any of the following:

- a duplicate or malformed requirement identifier;
- a gap in an area's identifier sequence, which usually means a requirement was dropped;
- a status outside the allowed set;
- an evidence path that does not exist in the repository;
- a `COMPLIANT` entry with no implementation, or with neither tests nor documentation;
- a `NON_COMPLIANT` or `NOT_APPLICABLE` entry with no stated reason;
- a `NOT_VERIFIED` entry with no `verification_scope` or no limitation;
- a requirement with no implementation, no tests, and no stated limitation;
- an integration placeholder on a `COMPLIANT` entry, or one with no limitation;
- a published Markdown file that disagrees with the JSON.

## Adding a requirement

1. Add an object to `config/traceability-matrix.json` using the next free number in its area prefix.
   Identifiers must stay dense and start at `01`.
2. Write an original summary. Do not copy source wording.
3. Reference real repository paths. Directories are acceptable when a whole directory implements the
   requirement.
4. Be conservative with `status`. Prefer `PARTIALLY_COMPLIANT` with an honest limitation over an
   optimistic `COMPLIANT`.
5. Run `npm run generate:traceability` and `npm run check:traceability`.
