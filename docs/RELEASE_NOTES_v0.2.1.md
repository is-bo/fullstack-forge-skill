# Fullstack Forge v0.2.1 — Release-readiness corrections

v0.2.1 makes the upstream-powered architecture operational and closes the integrity, packaging,
offline-behaviour, upgrade, coverage, and release-retry gaps found in the v0.2.0 review.

## Highlights

- The real module path now resolves specialist composition from repository evidence and explicit
  requests, enforces deterministic budgets, validates installed runtime paths, and records selected
  and suppressed provenance.
- Activation supports nested `allOf`, `anyOf`, and `not` conditions. Exact provider matching avoids
  substring false positives; explicit requests outrank direct evidence, other conditions, and
  always-on guidance. Sentry SDK guidance requires both Sentry and its matching stack.
- Shipped guidance cannot install another skill product or retain independent activation or tool
  authority. Unreachable skill families and unverified executable tiers were removed.
- Every platform archive includes canonical Forge skills, compiled upstream guidance, required
  manifests, and attribution, and is extracted and inspected in a clean room.
- Doctor is offline by default, bare update and uninstall are host-scoped, stale owned files retire
  safely without retaining ownership of preserved user modifications, vendored licence evidence is
  checked, and supported Node coverage is no longer reporter-dependent.
- Exact-head CI and the tag release gate exercise a genuine public v0.1.0-to-v0.2.1 upgrade; the npm
  payload excludes source-only upstream maintenance tools and does not advertise broken package
  scripts. Its retained offline `upstream:verify` command validates the shipped runtime directly.
- Release preflight detects existing drafts across paginated results and refuses to replace or
  duplicate a release.

## Availability

This tagged-source document does not claim publication. The GitHub Release, exact-head CI, CodeQL,
attestations, immutable assets, and downloaded-byte verification remain pending until observed.
`v0.2.0` remains a tagged but unpublished historical state and will not be moved or republished. npm
publication remains unconfigured.

## Known limitations

- Live activation in each supported agent host remains `NOT_VERIFIED` until exercised there.
- Analyzer precision against an independent external corpus remains `NOT_VERIFIED`.
- Impeccable is integrated as reviewed guidance through a Forge translation adapter; its detector
  engine is not shipped or claimed to execute.
- Provider or framework combinations not represented in the composition manifest remain unsupported
  rather than inferred.
