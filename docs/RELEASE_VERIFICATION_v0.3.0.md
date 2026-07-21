# Release verification — v0.3.0

Verification stage: CANDIDATE_LOCAL

Local validation status: PENDING

Remote publication status: PENDING

This candidate record is intentionally incomplete until the final source edit is followed by the
entire local release matrix. Before tagging, it will be updated to `TAGGED_LOCAL` and local `PASS`
only if every required command and artifact check succeeds. Remote CI, publication, provenance,
immutability, and post-publication installation cannot be proven in tagged source and remain pending
for the release workflow.

## Baseline and environment

| Item               | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Baseline           | public v0.2.0 `main` before the v0.3 integration branch |
| Previous release   | `v0.2.0`                                                |
| Integration branch | `codex/v0.3.0-build-mode-evidence`                      |
| OS                 | Windows 10 Pro 10.0.19045, x64                          |
| Node.js            | v24.14.1                                                |
| npm                | 11.11.0                                                 |

## Candidate implementation evidence

The release branch contains domain-separated evidence envelopes, exact Build producers,
applicability and tier gates, schema-v2 project/feature state, full runtime and design evidence,
journaled migration, Ship stable-revision re-derivation, and both public v0.3 evaluation corpora.
The detailed defect-to-evidence classification is in `AUDIT_CLASSIFICATION_v0.3.0.md`.

## Local validation

PENDING. This section will record exact commands, counts, package hashes, and clean-install results
after the final source edit. No result is inferred from focused development tests.

## Independent pre-release review

PENDING. Security/evidence integrity, architecture/API/data/authorization, frontend/UI/UX/
accessibility, performance/reliability/observability, testing/evals, docs/public claims, and
compatibility/migration/package hygiene must each be reviewed against the completed candidate.

## Private and local material

Private specifications, local audit state, research temporaries, credentials, logs, and release
staging are excluded from version control and package allowlists. Before tagging, staged files, npm
inventory, ZIP inventory, and secret-scan output must be inspected directly.

## Pending remote steps

- Pull-request review and merge to `main`: PENDING
- Remote CI on the merge commit (Linux, Windows, macOS, dependency review, CodeQL): PENDING
- Annotated tag `v0.3.0` on the verified commit: PENDING
- Release workflow draft, attestations, downloaded-byte comparison, one-way publication, and
  immutability verification: PENDING
- Clean-room installation from the published tag and release assets: PENDING
- GitHub repository description/topics/social-preview visual check: PENDING
