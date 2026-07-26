# Audit classification — v0.5.1

This record classifies the Codex onboarding gaps in `PRODUCT_GAP_REPORT_v0.5.1.md`. `FIXED` means
the implementation and local focused regression evidence exist; it does not claim remote CI,
publication, or live execution inside the Codex picker.

| Gap          | Classification | Implementation and test evidence                                                | Residual boundary                                               |
| ------------ | -------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| FF-CODEX-101 | FIXED          | distinct beginner and expert metadata with schema/length assertions             | Live picker rendering requires a restarted Codex installation.  |
| FF-CODEX-102 | FIXED          | canonical router metadata, generated icon, six-root byte checks                 | Vendor hosts may ignore OpenAI-specific presentation metadata.  |
| FF-CODEX-103 | FIXED          | generated no-action instructions and no-write CLI integration test              | Agent wording can vary while preserving the required choices.   |
| FF-CODEX-104 | FIXED          | ten-choice renderer, choice mapping, help, and rebuilt CLI tests                | Interactive keyboard behavior remains terminal-host dependent.  |
| FF-CODEX-105 | FIXED          | bounded `data` candidates and transparent `database and queries` routing        | Other unknown phrases still require the existing bounded error. |
| FF-CODEX-106 | FIXED          | recursive Build-command sync, ownership manifests, validation, package tests    | Modified or unowned generated files continue to block updates.  |
| FF-CODEX-107 | FIXED          | package, skill, README, onboarding, command, platform, and troubleshooting docs | Codex does not expose nested native commands for Forge actions. |

## Compatibility and security result

- All 46 skills remain in every generated root, including the advanced `fullstack-forge`,
  `forge-security`, `forge-ui`, `forge-database`, `forge-feature`, and `forge-new` entries.
- The router still calls the existing engines. No analyzer, evidence producer, schema, finding ID,
  safe-fix authority, command-execution authority, or Ship authority was added.
- Fix remains preview-only unless the user explicitly selects the safe application action.
- Missing tools and unavailable evidence remain visible and cannot become `PASS`.
- Generated roots remain path-contained, symlink-free, ownership-manifest driven, and hash checked.

## External limitations

Local metadata and package inspection prove the files that Codex can discover; they do not prove
that a running Codex process has refreshed its cache or rendered the picker. Restart and visual
confirmation remain post-installation steps. Remote CI, CodeQL, attestations, immutable release
state, and public-tag installation require direct post-commit or post-tag evidence.
