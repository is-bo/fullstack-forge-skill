# Build brief: Software supply chain

## Decide before coding

- Decide whether a new dependency is actually needed before adding one; check for an existing dependency or a small amount of own code that already covers it.
- Decide the version-pinning approach for any new dependency or CI action, so a build does not silently pick up an unreviewed update.
- Decide who reviews a new dependency's install scripts, maintenance status, and transitive footprint before it is added to the lockfile.
- Decide how a discovered vulnerability in a dependency this feature uses will be triaged for actual reachability, not resolved by version number alone.
- Decide whether this feature's build or release step introduces any new untrusted input into the CI pipeline, and how that input is constrained.

## Evidence to produce while building

- The specific justification for any new dependency, including why an existing one did not suffice.
- A lockfile update showing the new dependency pinned, with its install scripts reviewed or disabled where possible.
- Confirmation that a rebuild from a clean checkout with the lockfile reproduces the same dependency tree.
- A vulnerability-scan result for the updated dependency set, with any findings triaged for reachability.
