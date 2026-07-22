# Audit classification — v0.4.0

This record closes the ten product-layer gaps captured before implementation in
`PRODUCT_GAP_REPORT_v0.4.0.md`. `FIXED` means implementation and local regression evidence exist; it
does not claim remote CI, publication, or production behavior.

| Gap                                              | Classification | Implementation evidence                                                              | Residual boundary                                            |
| ------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| FF-PRODUCT-001 simple commands absent            | FIXED          | `cli/src/simple-cli.ts`, simple CLI integration tests                                | Agent hosts expose named skills differently.                 |
| FF-PRODUCT-002 no `/forge` product skill         | FIXED          | canonical/generated `commands/forge/SKILL.md`, catalog/platform validation           | Host slash UI remains platform-specific.                     |
| FF-PRODUCT-003 no guided entry                   | FIXED          | closed menu model, TTY dispatcher, noninteractive E2E                                | Real Windows pseudo-TTY UI is not automated locally.         |
| FF-PRODUCT-004 no natural feature input          | FIXED          | redacted slug derivation/collision tests and Build E2E                               | Product ambiguity still needs agent/user judgment.           |
| FF-PRODUCT-005 continue only points              | FIXED          | unique-feature continuation and multi-feature refusal tests                          | Interactive choice is not used in scripts.                   |
| FF-PRODUCT-006 overwhelming human output         | FIXED          | compact audit/fix/install/doctor/status renderers, details/JSON tests                | Full reports remain technical by design.                     |
| FF-PRODUCT-007 doctor under-checks setup         | FIXED          | expanded doctor and tamper/missing/ready tests                                       | Remote update availability is not queried.                   |
| FF-PRODUCT-008 install path is hard to recognize | FIXED          | ready output, exact recovery, first-party smoke/offline and third-party copy install | Third-party lifecycle differs from Forge manifests.          |
| FF-PRODUCT-009 missing goal guides               | FIXED          | eight short guides, simple-first README, advanced reference retained                 | Translation/localization is not included.                    |
| FF-PRODUCT-010 no onboarding demo                | FIXED          | `examples/quickstart-demo`, compiled E2E                                             | Ship correctly remains blocked without all release evidence. |

## Compatibility result

- 42 Audit module slugs and every expert verb remain present.
- Report schema 2, finding fields/IDs, Build schema 2, migration behavior, exit meanings, JSON
  structures, and the installer manifest remain compatible.
- The new `forge` skill and simple verbs are additive. `--details` restores the prior full Markdown
  terminal view for simple audit/verify/ship commands.
- Historical v0.2/v0.3 release documents remain unchanged records of those candidates.

## Security result

- No simple route executes through a shell or bypasses `--allow-run`.
- Input redaction precedes slugging and state persistence; output also uses shared redaction.
- Unknown, misspelled, and ambiguous commands do not execute a different action.
- Fix preview is no-write; writes remain registered, structurally bounded, hash-current, contained,
  link-refusing, and explicitly selected with `--safe`.
- Doctor hashes every manifest-owned installed file and reports changed or missing records.
- Generated and distribution inventories remain allowlist/ownership driven and include no private
  specifications, local Forge state, credentials, task staging, or links.

## Acceptance still required

The release candidate still requires final full checks, coverage, deterministic packaging,
distribution validation, clean first-party and offline installations, dependency audit, inventory
inspection, remote CI, immutable publication, and post-publication clean-room verification. Those
stages are tracked separately in `RELEASE_VERIFICATION_v0.4.0.md`.
