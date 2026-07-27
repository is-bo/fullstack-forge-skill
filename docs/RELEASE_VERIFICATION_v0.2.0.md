# Fullstack Forge v0.2.0 release verification

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This record describes the upstream-powered architecture release candidate prepared for tagged
source. No GitHub Release, remote CI result, or published asset is claimed here before it is
directly observed.

## Required local evidence

- [x] `npm run upstream:verify`: 8 providers, 905 vendored files, every pin a full 40-character
      commit SHA, every checksum matching, no undeclared file, no symlink, no traversal, no nested
      repository, no LFS pointer, no undeclared executable, and no unreviewed hard-deny instruction
- [x] generation is deterministic: `npm run generate` followed by `git diff --exit-code`
- [x] formatting, lint, typecheck, tests, validation, and full `npm run check`
- [x] composition and provider gating: React, React Native, Vercel, Supabase, PostgreSQL,
      Cloudflare, Sentry, Google Cloud, GKE, Stripe, and PayPal each activate only on proven
      evidence or an explicit request, and stay suppressed otherwise
- [x] no upstream skill is host-discoverable: zero `SKILL.md` files in the compiled upstream tree
      and in a freshly installed project
- [x] no upstream update check and no telemetry in any vendored runtime module
- [x] detector mapping: subjective craft results are advisories that cannot block Ship, and no
      detector output can produce a `PASS`
- [x] deterministic platform packaging and archive validation
- [x] fresh, fixture-update, uninstall, and offline installation: 46 skills per platform, zero
      symlinks, upstream tree and manifests installed once, and clean uninstall
- [x] dependency audit: zero known vulnerabilities
- [ ] exact-clean-main `forge ship --allow-run --json` on the merged commit

## Required remote evidence

- [ ] Ubuntu CI on Node 20, 22, and 24
- [ ] Windows CI on Node 20, 22, and 24
- [ ] macOS CI on Node 20, 22, and 24
- [ ] dependency review and CodeQL on the exact final pull-request head
- [ ] annotated `v0.2.0` tag on the exact verified merge commit
- [ ] published archives, checksums, and downloaded-byte verification

Remote steps remain pending until the corresponding GitHub state and workflow results are observed.

## Known limitations carried into this release

- `$forge ui live` ships guidance only; the upstream interactive live-editing runtime is not
  vendored.
- `sentry-setup-metrics` does not exist upstream at the pinned commit.
- Vercel and Sentry declare their licences in `README.md` rather than in a `LICENSE` file at the
  pinned commits. Both declarations are recorded verbatim as licence evidence and flagged for
  explicit review.
- Analyzer precision remains unbenchmarked against an independent external corpus.
