# Fullstack Forge v0.1.4 post-release verification

Verification stage: POST_TAG_COMPLETE

Remote publication status: PASS

Generated after publication on 2026-07-19. This document was not present in the v0.1.4 tag and is
not a replacement for the checksummed, attested evidence asset attached before immutable
publication. It records the independent post-publication checks and one evidence-link limitation
discovered afterward.

## Identity and remote state

| Item                     | Verified value                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Corrective pull request  | [#11](https://github.com/is-bo/fullstack-forge-skill/pull/11)                                    |
| Final tagged main commit | `ada9d12cb1abc928ed3a46c7989e4443e0281d23`                                                       |
| Annotated tag object     | `dd89c152afe5043660717c5c15d95b174d9c8f4e`                                                       |
| Tag                      | `v0.1.4`, remotely peeled to the tagged main commit                                              |
| Release                  | [Fullstack Forge v0.1.4](https://github.com/is-bo/fullstack-forge-skill/releases/tag/v0.1.4)     |
| Publication              | 2026-07-19T08:39:57Z; non-draft, non-prerelease, immutable                                       |
| PR CI                    | [run 29679929121](https://github.com/is-bo/fullstack-forge-skill/actions/runs/29679929121)       |
| PR CodeQL                | [run 29679929080](https://github.com/is-bo/fullstack-forge-skill/actions/runs/29679929080)       |
| Main CI                  | [run 29680049093](https://github.com/is-bo/fullstack-forge-skill/actions/runs/29680049093)       |
| Main CodeQL              | [run 29680049085](https://github.com/is-bo/fullstack-forge-skill/actions/runs/29680049085)       |
| Release workflow         | [run 29680167897](https://github.com/is-bo/fullstack-forge-skill/actions/runs/29680167897), PASS |

PR and main CI passed the Linux, Windows, and macOS verification matrix. PR dependency review and
both PR/main CodeQL analyses passed. At final requery, Dependabot, code-scanning, and
secret-scanning each reported zero open alerts.

## Published assets

`gh release verify v0.1.4` passed. All 13 downloaded assets independently passed
`gh release verify-asset`, and GitHub's asset digests matched the downloaded bytes.

| Asset                                      | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `fullstack-forge-all-v0.1.4.zip`           | `7953951c4a1dda2fd8e48b1c0e3087288971d54ac15577b9c5828c34a40a1e98` |
| `fullstack-forge-antigravity-v0.1.4.zip`   | `ea482f4aec9c0f6b9b725edcd2bab27c6647ba1c3b336841f0401e49607490b4` |
| `fullstack-forge-claude-v0.1.4.zip`        | `dc022bbf3743f81e9a67d8030d98890e9ff158297b6e2fdda59e70e3e1976535` |
| `fullstack-forge-codex-v0.1.4.zip`         | `ea482f4aec9c0f6b9b725edcd2bab27c6647ba1c3b336841f0401e49607490b4` |
| `fullstack-forge-cursor-v0.1.4.zip`        | `7bd88b7a1bea9270db057ea0ebab5c54f13423648616cafecaac6aaf4978f546` |
| `fullstack-forge-gemini-v0.1.4.zip`        | `31522d8325f61ab7e0dff789330f6c4baa6155e275ab2a1700a38e6c6d9373ad` |
| `fullstack-forge-generic-v0.1.4.zip`       | `ea482f4aec9c0f6b9b725edcd2bab27c6647ba1c3b336841f0401e49607490b4` |
| `fullstack-forge-github-v0.1.4.zip`        | `eb73630365852269762dd1239410aeb2ed9113086dd32a71f3bfd2d64a65a36b` |
| `fullstack-forge-windsurf-v0.1.4.zip`      | `035a3a783406168635884d65379b783c9a09490d0c322bf34c0e4358fb82c58e` |
| `SHA256SUMS.txt`                           | `6faebe0be1511a7dce05407a867abc1811fb17bc51cdf1b6714aec91c6344793` |
| `manifest.json`                            | `4f564a7982c8839bf9e9ea39f8bba008b74340d7283bed09218700e2c2c970f6` |
| `FINAL_RELEASE_VERIFICATION_v0.1.4.md`     | `72fa817cad0d45edca8496953b09d4f2666f41505de8bbf6d3a730bcadaa4bee` |
| `FINAL_RELEASE_VERIFICATION_v0.1.4.sha256` | `ae7ba304a711c4f6287f61a7db77496fa58007b2313876b4ca0124f1346ec997` |

All nine lines in `SHA256SUMS.txt` passed independent hash comparison. The final evidence document
also matched its dedicated checksum. The release and all assets have GitHub attestations, and the
repository immutable-release API and release object both report immutability enabled.

## Clean-room installation and behavior

- `npm install github:is-bo/fullstack-forge-skill#v0.1.4` in an empty project resolved the lockfile
  to `ada9d12cb1abc928ed3a46c7989e4443e0281d23` and reported CLI version 0.1.4.
- A fresh tarball packed from that installed tag had SHA-256
  `dcbcc9d44ab631d7289b6472718fda7f5055c09ef2531ab6229eb2ea2d2e3d27`; installation into a second
  empty project reported version 0.1.4.
- The downloaded Codex archive extracted into an empty directory with 43 skills, zero symlinks or
  reparse points, no private specification, and no active fixture manifests.
- The installed tag CLI reproduced six SQL, one shell, three SSRF, three generic-validation, and six
  distinct authorization findings in the purpose-built regression project. The corresponding safe
  parameterized, shell-separated, allowlisted/no-redirect, owner-predicate, dominating-guard, and
  shadowed-binding cases remained suppressed by the automated release tests.

## Evidence-link limitation and resolution

The immutable `FINAL_RELEASE_VERIFICATION_v0.1.4.md` asset was correctly generated while the release
was a draft and truthfully labels publication `PENDING_ATOMIC_PUBLISH`. Its `Release:` field
captured GitHub's temporary `untagged-*` draft URL, which returns 404 after publication. The asset's
tag, commit, workflow run, checksums, attestations, and hosting release remain valid, and the
canonical published URL is recorded above.

The release and its evidence asset cannot be changed without violating immutability. The workflow on
`main` now constructs the deterministic canonical `/releases/tag/$TAG` URL before publication, and a
policy regression test prevents the temporary-draft URL pattern from returning in future releases.
