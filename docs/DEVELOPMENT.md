# Development

## Requirements

- Node.js 24 or newer
- npm with lockfile support
- Git

```bash
npm ci
npm run generate
npm run typecheck
npm run lint
npm test
```

`src/fullstack-forge/` and `config/modules.json` are canonical. Generated platform copies must not
be edited directly. Synchronization uses per-file hash manifests and refuses a changed generated
file; restore the intended canonical change or deliberately reconcile the generated file before
retrying.

## Scripts

- `npm run generate`: render 42 audit command skills (`generate-modules.mjs`), render the two build
  command skills and every `references/build/<slug>.md` discipline brief (`generate-build.mjs`), and
  synchronize all platform roots (`sync-platform-assets.mjs`).
- `npm run build`: generate and compile the CLI.
- `npm run test`: build and run Node's test runner.
- `npm run validate`: validate skill structure, metadata, schemas, and required files.
- `npm run check:platforms`: compare generated contents and ownership manifests.
- `npm run package:platforms`: build deterministic ZIP archives and checksums.
- `npm run smoke:install`: pack locally, install in a temporary consumer, and test lifecycle.
- `npm run offline:install`: warm runtime dependencies, then install the packed artifact with
  `--offline` (cache-only, no network) and generate every platform root against an unreachable
  registry.
- `npm run test:coverage`: run the suite with Node's experimental coverage reporter and enforce the
  committed overall and risk-focused non-regression floors in `config/coverage-thresholds.json`.
- `npm run check:fixtures`: prove scanner fixtures contain no installable dependency roots.
- `npm run check:workflows`: enforce full Action SHA pins, credential-free checkout, cross-platform
  CI, dependency review, CodeQL, and non-clobbering immutable-release policy.
- `npm run check:release-docs`: reject tagged records that claim future remote publication already
  completed or omit completed local validation.
- `npm run check`: formatting, lint, type, tests, validation, and synchronization.

CI runs the full verification on Linux, Windows, and macOS, fails on stale committed `build/`
output, enforces coverage, and verifies both smoke and offline installation. The release workflow
creates a new draft only after proving the tag and release preconditions, attests every archive,
verifies downloaded bytes, attaches checksummed final evidence, publishes once, and verifies GitHub
release immutability.

## Adding a module

The public module set is intentionally closed for `0.1.x`. A future module change requires a catalog
entry, generator update if needed, exact-set tests, platform regeneration, CLI catalog update, docs,
fixtures, changelog, and a versioned compatibility decision.

See [ADDING_A_MODULE.md](ADDING_A_MODULE.md) and [ADDING_A_PLATFORM.md](ADDING_A_PLATFORM.md) for
the complete compatibility, evidence, generation, and verification checklists.

## Test discipline

Tests should assert behavior and security properties: traversal refusal, symlink refusal, conflict
preservation, exact module set, scanner redaction, profile evidence, report validation,
deterministic output, package exclusions, and clean install/uninstall. Use only temporary
directories whose resolved path and prefix are checked before removal.

## Roadmap

The `0.1.x` line keeps the 42-module catalog stable while improving inspector precision, fixture
coverage, package validation, and verified platform compatibility. Future browser, database, and
provider adapters must preserve offline operation, explicit authorization, direct evidence, and the
fail-closed contract. New platforms and breaking module changes require primary-source research and
a versioned compatibility decision.
