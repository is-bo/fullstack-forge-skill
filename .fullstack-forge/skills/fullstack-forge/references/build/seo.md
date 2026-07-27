# Build brief: Search discoverability

## Decide before coding

- Decide whether this route is meant to be publicly indexable at all before writing metadata for it; private or tenant content must never become indexable by default.
- Decide the canonical URL, title, and description for each new public route before it ships, rather than leaving framework defaults in place.
- Decide whether this content needs structured data, and which schema type actually matches it, instead of adding structured data generically.
- Decide how this route behaves for a crawler that cannot execute client-side rendering, if that is a risk for the chosen rendering strategy.
- Decide the redirect and duplicate-URL handling for this route (trailing slash, casing, query parameters) so one page does not fragment into several indexable URLs.

## Evidence to produce while building

- A recorded NOT_APPLICABLE with the reason for any route intentionally excluded from indexing.
- The rendered HTML (not just source) showing title, canonical, and metadata for each new public route.
- Validated structured data output for any route that declares it.
- Confirmation that no private or tenant-scoped route is reachable by a crawler or listed in a sitemap.
