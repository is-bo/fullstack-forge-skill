# Fullstack Forge v0.1.0 release verification

Verification stage: TAGGED_LOCAL

Local validation status: PASS

Remote publication status: PENDING

This record describes the reset agent-first release candidate prepared for tagged source. No GitHub
Release, release deletion, remote CI result, or published asset is claimed here before it is
directly observed.

## Required local evidence

- [x] generation, formatting, lint, typecheck, tests, coverage, validation, and full `npm run check`
- [x] automatic activation, managed instruction update/uninstall, proportional evals, agent finding
      ingestion, and report consistency
- [x] deterministic platform packaging: 9 archives and 2,173 validated entries
- [x] fresh, fixture-update, uninstall, and offline installation: 46 skills per platform, zero
      symlinks, automatic activation present, and clean uninstall
- [x] dependency audit: zero known vulnerabilities
- [x] coverage thresholds: 94.58% lines, 82.85% branches, and 94.33% functions
- [ ] exact-clean-main `forge ship --allow-run --json`: exit 0 with revision-bound evidence and no
      failing findings or gates

## Required remote evidence

- [ ] Windows CI
- [ ] Ubuntu CI
- [ ] macOS CI
- [ ] dependency review and CodeQL
- [ ] preview Release/tag inventory and dependency check
- [ ] approved preview Release/tag cleanup
- [ ] annotated `v0.1.0` tag on the final validated commit
- [ ] published archives, checksums, attestations, and downloaded-byte verification

Remote steps remain pending until the corresponding GitHub state and workflow results are observed.
