# Audit classification — v0.3.0

This record classifies the eight public Build-mode release gaps against the v0.3 implementation.
`FIXED` means the product code and focused regression evidence exist on the release branch; it does
not claim remote CI, publication, or post-release verification. Those remain tracked separately in
`RELEASE_VERIFICATION_v0.3.0.md`.

| ID      | Baseline defect                                                                                                   | Classification | v0.3 evidence                                                                                                       | Residual boundary                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DEV-001 | Build and Ship could trust editable evidence records without a complete producer/root/revision/artifact contract. | FIXED          | `cli/src/evidence-envelope.ts`, `cli/tests/evidence-envelope.test.ts`, Ship integration tests                       | Local envelopes are integrity/freshness records, not external signatures.                                         |
| DEV-002 | `forge new` did not persist the complete product foundation needed by later features.                             | FIXED          | `cli/src/build.ts`, `cli/src/build-state.ts`, schema-v2 project schema and Build tests                              | The CLI records inputs but cannot grade product reasoning.                                                        |
| DEV-003 | Build criteria lacked an exact producer interface and could over-credit generic command success.                  | FIXED          | `cli/src/build-producers.ts`, `cli/tests/build-producers.test.ts`                                                   | A required criterion without a registered/detected producer stays `NOT_VERIFIED`.                                 |
| DEV-004 | Discipline applicability and tier gates were advisory enough to omit material requirements.                       | FIXED          | `cli/src/build-applicability.ts`, `cli/src/build-gates.ts`, corresponding tests                                     | Static applicability is bounded by classified evidence and is re-derived; unknown capabilities remain unresolved. |
| DEV-005 | UI completion had no enforced state/viewport runtime matrix or design-direction evidence.                         | FIXED          | `cli/src/build-runtime.ts`, `cli/tests/build-runtime.test.ts`, Build integration tests                              | Browser, assistive-technology, and human visual judgment require the real environment/reviewer.                   |
| DEV-006 | Repeatable v0.3 evidence and prevention evaluations did not cover the required product tasks.                     | FIXED          | `evals/v030-build-mode`, `evals/v030-prevention`, two compiled test runners                                         | Nondeterministic, human, browser, provider, and unsupported external checks never count as deterministic `PASS`.  |
| DEV-007 | Build state had no explicit, safe compatibility path from v0.2 schema v1.                                         | FIXED          | `cli/src/build-migration.ts`, `cli/src/build-migration-journal.ts`, `cli/tests/build-migration.test.ts`             | Migration is operator-triggered and refuses mixed, malformed, changed, or unsafe state.                           |
| DEV-008 | Public docs and release artifacts described v0.2 behavior and omitted producer/gate/migration contracts.          | FIXED          | Build, command, CLI, architecture, analyzer, security, contributor, platform, changelog, and v0.3 release documents | Remote publication evidence cannot exist in tagged source and remains pending until the release workflow.         |

## Security findings resolved during implementation

| Risk                                                                                | Resolution                                                                                                                                                                        | Regression evidence                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Editable prior Audit/Ship status could influence Ship.                              | Ship now re-discovers and re-inspects a stable current revision; prior reports are diagnostics only. Current claims require registered Ship envelopes and re-hashed artifacts.    | `cli/tests/gates.test.ts`, Ship integration tests                |
| Build positive records could be planted, replayed, or moved across roots/revisions. | Positive records require a registered producer, exact outer/envelope agreement, canonical root, current revision, expiry, complete artifacts, and current in-memory verification. | Build state, producer, gate, and envelope tests                  |
| Runtime evidence hashes and state coverage were incomplete.                         | Runtime `PASS` requires all eight states at the three fixed viewports exactly once and binds observed context plus artifact hashes.                                               | `cli/tests/build-runtime.test.ts`, v0.3 eval corpus              |
| Release packaging relied on incomplete denylisting.                                 | Archive inventory is allowlist-driven and rejects private/local state, specifications, credentials, logs, unsafe paths, and symlinks.                                             | `scripts/tests/package-policy.test.mjs`, distribution validation |
| Command and evidence diagnostics could expose secret-bearing text.                  | Command execution, ledgers, definitions, argv, errors, and runtime URLs use shared redaction; evidence stores a raw-output digest rather than raw bytes.                          | Ship redaction and runtime tests                                 |

## Compatibility decision

- The 42 Audit modules and existing Audit CLI verbs remain stable.
- Existing Audit reports migrate in memory and remain useful as historical diagnostics; legacy
  evidence cannot satisfy v0.3 Ship.
- v0.2 Build state is schema v1 and is refused until `forge migrate build` is explicitly reviewed
  and run. Legacy positive evidence and risk acceptances are preserved only as expired,
  `migrated-untrusted` diagnostics.
- Build and Ship producer registries are intentionally separate. No compatibility shim promotes
  Build state into release evidence.

## Release acceptance still required

Implementation classification is not publication evidence. The candidate must still pass the full
repository check, v0.3 eval command, dependency audit, deterministic double packaging, distribution
validation, package inventory review, clean installation, independent security/compatibility review,
remote CI, immutable tag/release workflow, downloaded-asset verification, and post-publication
clean-room installation.
