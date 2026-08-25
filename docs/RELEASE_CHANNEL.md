# Public release channel

Fullstack Forge discovers updates only through the repository's public GitHub Releases channel:

`GET https://api.github.com/repos/is-bo/fullstack-forge-skill/releases/latest`

Tags alone are not releases and never make a version installable. The client accepts a response only
when it is valid JSON for a non-draft, non-prerelease, immutable release with a canonical
`vMAJOR.MINOR.PATCH` tag and publication timestamp. Every returned asset must be an uploaded,
positive-size file at the exact repository release-download URL, with no unsafe or duplicate name.

The release must include all nine version-bound platform ZIPs, `SHA256SUMS.txt`, and
`manifest.json`. Starting with `v0.2.3`, it must also include the exact
`fullstack-forge-skill-vMAJOR.MINOR.PATCH.tgz` and its matching
`fullstack-forge-skill-vMAJOR.MINOR.PATCH.spdx.json`. Recovery downloads the exact `.tgz`; it does
not synthesize an install from a tag snapshot. `v0.2.2` remains an explicit legacy exception because
that already-immutable release predates exact-package and SBOM assets.

Malformed, incomplete, mutable, draft, or prerelease responses produce no update. Network failures
are warning-only for normal online commands, and `--offline` performs no release-channel I/O. This
fail-closed behavior prevents a tag, partial draft, or ambiguous API response from becoming an
installation source.
