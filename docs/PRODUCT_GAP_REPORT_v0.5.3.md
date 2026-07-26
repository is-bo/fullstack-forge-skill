# Product gap report — v0.5.3

## Confirmed gaps

- The former GitHub username remained in metadata, public documentation, update guidance, generated
  schema IDs, and release evidence.
- `DEFAULT_EXCLUSION_CATEGORIES` treated every `uploads`, `logs`, `attachments`, or `backups`
  segment as private runtime data, including committed application source.
- Platform archives contained Markdown whose local destinations were absent from the ZIP allowlist.

## Required outcome

Fullstack Forge must use `is-bo/fullstack-forge-skill` as its public identity, inspect committed
application source regardless of a runtime-looking path segment, and fail closed when a top-level
untracked runtime-looking text path is ambiguous. Every packaged relative Markdown link must resolve
inside the same archive.

The corresponding design is in [PRODUCT_LAYER_DESIGN_v0.5.3.md](PRODUCT_LAYER_DESIGN_v0.5.3.md),
with release status tracked in [RELEASE_VERIFICATION_v0.5.3.md](RELEASE_VERIFICATION_v0.5.3.md).
