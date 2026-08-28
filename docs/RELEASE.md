# Release process

The public update channel is GitHub Releases, not Git tags. `v0.2.0` and `v0.2.1` are tagged but
unpublished historical states and must never be moved, deleted, or republished. `v0.2.2` is the
current immutable public release and must not be moved, replaced, or republished. `v0.3.1` is the
current candidate and is not public until its GitHub Release and downloaded evidence are directly
observed. Keep every historical version-stamped note and verification record intact; new evidence
belongs in new v0.3.1 files. The `v0.3.0` tag remains historical and must not be moved or reused.
npm registry publication remains unconfigured.

`fullstack-forge-skill@0.3.1` is unpublished; any future registry publication remains `NOT_VERIFIED`
until independently observed.

## Candidate gate

1. Update every version-bearing source and add version-stamped release notes and candidate
   verification. Do not rewrite historical evidence.
2. Run the focused tests for the changed surfaces, then the complete checks in `AGENTS.md`,
   coverage, dependency audit, package validation, exact-artifact smoke install, genuine upgrades
   from the initial supported `v0.1.0` and current public `v0.2.2` releases, and offline install.
3. Generate the release bundle once with `npm run package:platforms`. It contains nine deterministic
   platform ZIPs, the exact npm-pack `.tgz`, a deterministic SPDX 2.3 SBOM, `SHA256SUMS.txt`, and
   `manifest.json`. The package generator produces npm pack twice and refuses unequal bytes.
4. Inspect the npm inventory and SBOM. The package must contain the CLI and canonical skill, exclude
   local/private material, and bind runtime npm dependencies plus vendored providers to checksums
   and provenance.
5. Merge through a protected pull request. Required protection must include the three platform CI
   checks, dependency review, and CodeQL. The approving-review requirement observed while preparing
   this candidate is `0`, so branch protection does not currently prove human approval and must not
   be described as doing so. Dependency review is pull-request evidence and cannot be reconstructed
   from a later tag run.

## Publication

1. Create an annotated `vX.Y.Z` tag on the exact verified main commit. Never move a release tag.
2. Before enabling the tag workflow, provision the repository secret `RELEASE_ADMIN_TOKEN` with
   read-only **Administration** permission for this repository. GitHub's immutable-release settings
   endpoint does not accept the ordinary `GITHUB_TOKEN`; the workflow fails closed before creating a
   draft when this secret is missing or under-scoped. Keep the secret limited to the release
   environment and rotate it through the repository's normal credential process.
3. The tag workflow makes a one-shot GitHub Actions lookup for that exact commit and requires
   completed successful push runs named `CI` and `CodeQL` before it creates attestations or a draft.
   There is no polling: if either run is missing, pending, malformed, or failed, the release stops.
4. Release preflight inventories all releases (including drafts), assets, and attestations and fails
   closed on existing or ambiguous state. Investigate a partial run; never clobber or replace
   assets.
5. The workflow regenerates and validates the bundle, installs the exact generated `.tgz`, attests
   every file under `dist/`, and uploads that same byte set to a new draft release.
6. It downloads the draft into a clean directory, compares every checksummed payload byte-for-byte,
   extracts the Codex archive, and generates separately attested final evidence.
7. Only then does it publish the draft once, require GitHub release immutability, verify every asset
   attestation, and confirm that the remote tag still resolves to the candidate commit.

Candidate and final evidence attestations are verified against the exact release workflow signer;
repository/source matching alone is not sufficient provenance.

The tag workflow's exact-SHA gate supplements repository rules; it does not replace branch
protection. Required status checks apply to administrators, but human approval remains
`NOT_VERIFIED` while the required approving-review count is `0`. Changing that hosted policy is a
separate administrative action. Never report a remote result that was not directly observed. See
[RELEASE_CHANNEL.md](RELEASE_CHANNEL.md) for the client-facing discovery contract.
