# Fullstack Forge — completion implementation report

**Status: partial.** Three of the five remaining implementation items are complete and validated.
Two are not started. Stage 1 independent verification, Stage 2 external benchmarking, and Stage 3
release scoring were not performed. This report records what was actually done and what was not;
nothing here is estimated or inferred.

## Baseline

| Item                  | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Repository            | `is-bo/fullstack-forge-skill`                                      |
| `main` at start       | `3f73177654f9c7a58a93b83d33c1afa46d86caca`                         |
| Expected SHA present  | Yes — `main` had not advanced past #53                             |
| Previous baseline     | `d53f70ea` (present)                                               |
| Package version       | `0.1.0` (unchanged by this work)                                   |
| Tags                  | `v0.1.0` only (none added)                                         |
| Working tree at start | Clean                                                              |
| Node / npm            | v24.14.1 / 11.11.0                                                 |
| OS                    | Windows 10 Pro 19045, PowerShell                                   |
| Repository path       | `D:\Code\FullStack skill` — contains a space, exercised throughout |
| Baseline test suite   | 845 tests, 844 pass, 0 fail, 1 skipped, 93.9 s, exit 0             |

## Implementation branch and candidate

| Item                      | Value                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| Branch                    | `fix/complete-external-readiness`                                         |
| Candidate SHA             | `71edb67943e4fddf3dd5fd9953443cc75babad5c`                                |
| Commits ahead of baseline | 13                                                                        |
| Pull request              | https://github.com/is-bo/fullstack-forge-skill/pull/54 (open, not merged) |
| Version bump              | None                                                                      |
| Tag / release             | None                                                                      |

## Implementation agents

Six agents were launched (0A upload analysis, 0B transactions, 0C playbook deduplication, 0D
canonical installation, 0E imported-guard resolution, with integration reserved to the lead). **All
five worker agents terminated early on an account session limit**, not on task failure. Their
partial output was inspected and integrated by the lead agent; no agent's conclusions were accepted
as evidence, and every claim below was re-derived by the lead from actual command output.

State inherited from the terminated agents:

| Agent           | Left behind                             | Assessment                                              |
| --------------- | --------------------------------------- | ------------------------------------------------------- |
| 0A uploads      | nothing                                 | Not started                                             |
| 0B transactions | `cli/src/transactions.ts` (48 KB)       | Written, **orphaned and untested**                      |
| 0C playbooks    | `scripts/measure-boilerplate.mjs`       | Measurement script only, **no deduplication performed** |
| 0D installation | `managed-layout.ts` + installer rewrite | Substantial, **left the tree non-compiling**            |
| 0E guards       | `cli/src/guard-resolution.ts` (27 KB)   | Written, **orphaned and untested**                      |

"Orphaned" is material: both analyzer modules compiled but nothing imported them. Shipped as-is they
would have been dead code — precisely the "module reported as checked but the analyzer never
executed" failure the assignment treats as a hard gate.

## Files changed

New source: `cli/src/transactions.ts`, `cli/src/guard-resolution.ts`, `cli/src/managed-layout.ts`,
`scripts/lib/managed-layout.mjs`. New tests: `cli/tests/transactions.test.ts`,
`cli/tests/guard-resolution.test.ts`. Modified: `cli/src/analyzers.ts`, `cli/src/installer.ts`,
`cli/src/types.ts`, `cli/src/scope.ts`, `cli/tests/installer.test.ts`,
`scripts/sync-platform-assets.mjs`, `scripts/check-platform-assets.mjs`,
`scripts/check-repository-identity.mjs`, `scripts/smoke-install.mjs`, `scripts/upgrade-install.mjs`,
`scripts/offline-install.mjs`, `scripts/tests/openai-metadata.test.mjs`,
`scripts/tests/progressive-policy.test.mjs`, `package.json`, `.prettierignore`, plus regenerated
managed content.

## Architecture changed

- A single canonical managed-content root (`.fullstack-forge/skills/`) replaces six full host
  copies; hosts receive thin adapter files. No symlinks anywhere.
- `InstallFile` gains `kind` and `platforms`; the install manifest schema accepts `1 | 2` so the
  previous full-copy layout can be migrated rather than clobbered.
- Authorization guard recognition moves from three in-file helpers to one corpus-wide resolver that
  reads resolved bodies. `scope.ts` remains the only module resolver.
- Transaction analysis is a new per-file analyzer wired into the existing `js-ts-boundaries` pass.

## Transaction implementation

Detects multi-step write workflows where a partial failure violates an evidenced consistency
invariant. Relatedness requires structural evidence — shared entity identifier, foreign key, or
dataflow — so independent writes stay clean. Boundaries resolve through Prisma, Knex, Sequelize,
TypeORM, Drizzle, Mongo sessions, raw `BEGIN`/`COMMIT`, local aliases, and one level of wrapper
delegation. Unresolvable abstractions become `NOT_VERIFIED`, never a silent pass or a confident
fail. Severity reflects demonstrated impact: financial and access-control writes reach
HIGH/CRITICAL, ordinary parent/child pairs MEDIUM/HIGH.

Two defects were found by the new regression matrix and fixed:

1. **False positive.** `isKnownTransactionChain` branched on `segments.length === 1`. Because
   `callChain` records both a bare `run(cb)` and a member `prisma.$transaction(cb)` with one
   segment, every single-hop member call fell into the alias-only path where a vendor API could
   never match. Correctly wrapped Prisma and Knex transactions were reported. Fixed by
   distinguishing a bare call (`root === segments[0].name`) from a member call.
2. **Silent false negative.** `hasDataAccessReceiver` gated ambiguous verbs behind a receiver-name
   check, so a handle from a custom wrapper (`unit(async (handle) => handle.invoice.update(...))`)
   matched no known data-access name and the writes were not detected at all — no finding in either
   direction. Fixed with a narrow predicate: the receiver must be a parameter of a callback that is
   itself an argument to a call, so ordinary declaration parameters such as a route's `req`/`res`
   can never qualify.

Observed behaviour after the fixes:

| Case                                   | Result                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Related writes, no boundary            | `FF-DATA-TRANSACTION-001` FAIL, CRITICAL                                         |
| Same workflow in `prisma.$transaction` | clean                                                                            |
| Knex transaction over related writes   | clean                                                                            |
| Independent writes                     | clean                                                                            |
| Unresolved custom wrapper              | `FF-DATA-TRANSACTION-NOT-VERIFIED-001`, NOT_VERIFIED, evidence names the wrapper |

## Imported middleware resolution

`classifyRouteGuards` previously accepted any unresolved middleware whose identifier began with
`require|ensure|assert|check|verify|enforce|guard|can|is|has|only|restrict|protect|authorize|authenticate`
as a **proven** guard. An imported symbol never resolved to a local body, so every cross-file guard
took that path and an imported `requireAdmin` whose body only calls `next()` suppressed the route
finding entirely.

Classification now delegates to `createGuardResolver`, built once over the whole corpus, which reads
the body an import actually names. It follows local relative imports, renamed and default exports,
barrel re-exports, and middleware factories under explicit hop, file, and cycle budgets, and reuses
`scope.ts` rather than adding a second resolver. `isConventionalGuardName`, `resolveGuardFunction`,
and the in-file `functionDeniesAuthorization` are deleted.

| Case                                              | Result                                     |
| ------------------------------------------------- | ------------------------------------------ |
| Imported `requireAdmin`, body only calls `next()` | **FAIL** (previously suppressed as proven) |
| Imported `tollbooth`, body returns 403            | clean                                      |
| Barrel re-export of a real guard                  | clean                                      |
| Renamed import, default export, factory, two-hop  | clean                                      |
| External package (`@clerk/express`)               | `NOT_VERIFIED`                             |
| Cyclic imports                                    | `NOT_VERIFIED`, terminates                 |
| Dynamic `import()`                                | `NOT_VERIFIED`                             |

## Canonical installation

One managed copy under `.fullstack-forge/skills/`; each host root receives a `SKILL.md` adapter that
preserves the frontmatter the host needs for discovery and names the canonical playbook by relative
path. No symlinks. Codex is a documented exception — it reads `agents/openai.yaml` with ordinary
tooling and that file references its icon relatively, so `agents/` and `assets/` are copied verbatim
into `.agents` roots only.

**A shipping defect was found and fixed.** `installer.ts` reads bundled content from
`PACKAGE_ROOT/.fullstack-forge`, but that directory was absent from the `files` allowlist in
`package.json`, so the entire managed payload was excluded from the published tarball. Fresh
install, upgrade, and offline install all failed with `ENOENT` when run against a packed archive.
In-repo tests could not detect this because they read the working tree.

### Installation measurements

Measured from git object sizes across the six generated host roots.

|                        | Files      | Bytes      |
| ---------------------- | ---------- | ---------- |
| Before (`3f73177`)     | 804        | 6,704,066  |
| After — host roots     | 286        | 1,111,823  |
| After — canonical root | 134        | 1,117,347  |
| After — total          | 420        | 2,229,170  |
| **Reduction**          | **−47.8%** | **−66.7%** |

Generator output: 133 canonical files, 46 skills, 6 host roots, 276 adapters, 4 verbatim exception
files.

### Lifecycle scenarios executed

| Scenario                          | Result                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `smoke:install`                   | pass — 46 skills, automatic activation, 0 symlinks, clean uninstall                                 |
| `smoke:upgrade`                   | pass — migration from previous full-copy layout, doctor ready, 46/root, 0 symlinks, clean uninstall |
| `offline:install`                 | pass — six roots at 46 skills, cache-only npm, unreachable registry, 0 symlinks, clean uninstall    |
| Windows paths / paths with spaces | exercised throughout (repository path contains a space)                                             |
| Packaging                         | pass — 9 archives, 1083 entries                                                                     |

Not separately exercised: interrupted-migration resumability, damaged canonical/adapter recovery,
mixed partial-update upgrade, user-modified managed files, path-traversal rejection, and
`forge doctor` classification of canonical vs adapter vs user files. Several of these are covered
indirectly by existing installer tests but were not driven as named scenarios.

## Playbook deduplication

**Performed.** Primary boilerplate is 23.42%, against a target of below 25%.

Method: units are semantic — a frontmatter entry, heading, list item, or paragraph — then lowercased
and whitespace-collapsed, so re-wrapping prose cannot move the score. A unit counts as shared
boilerplate when it appears in at least 3 distinct files of the corpus. Units are weighted by token
count and every occurrence is weighted. A wrapping-independent 8-word shingle cross-check is
reported alongside.

Corpus: the 42 canonical specialist playbooks at
`src/fullstack-forge/commands/forge-<slug>/SKILL.md`.

| Measure                                   | Before                    | After                          |
| ----------------------------------------- | ------------------------- | ------------------------------ |
| Total tokens                              | 25,981                    | 22,396                         |
| Shared tokens                             | 8,545                     | 5,246                          |
| **Primary (literal units)**               | **32.89%**                | **23.42%**                     |
| Masked variant (module name/title masked) | 42.19%                    | 34.21%                         |
| Shingle-8 cross-check                     | 27.31%                    | 16.26%                         |
| Worst file                                | 37.80% (`forge-realtime`) | 26.93% (`forge-notifications`) |

What moved: a second scoped shared reference,
`src/fullstack-forge/references/shared/evidence-rules.md`, now owns four things named by its own
headings — "Statuses" (the `NOT_APPLICABLE` / `NOT_VERIFIED` / `BLOCKED` vocabulary and the rule
that absent evidence never becomes `PASS`), "Standards" (naming a standard is not a compliance
claim), "Tools" (deterministic inspectors give bounded evidence only) and "Findings" (the route to
`references/PROTOCOL.md`). `references/shared/module-contract.md` delegates those to it rather than
restating them, so the two shared files do not duplicate each other either. Each specialist cites
both documents and the topics each owns in a single sentence.

What deliberately stayed duplicated: the 14 section headings required by
`scripts/validate-skill.mjs` (1,974 of the 5,246 remaining shared tokens), the sentence "Never hide
failed checks or claim that an operation ran when it did not." which
`scripts/lib/skill-validation.mjs` requires verbatim in every skill (588 tokens), and the
slug-templated activation and audit-command lines, which are load-bearing for automatic activation.

No module-specific content was moved out. YAML frontmatter, `name`, `description` and therefore
automatic activation are byte-identical: the commit changes zero bytes under `.agents/`, `.claude/`,
`.cursor/`, `.gemini/`, `.github/skills/` and `.windsurf/`.

## Upload analysis

**Not implemented.** The analyzer remains the original raw-text regex gated on
`upload.(any|array|fields|single)`.

Behaviour characterised by probe (not fixed):

| Fixture                                                                         | Result                                 | Assessment                               |
| ------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| Hardened multer (private bucket, opaque key, signature check, fail-closed scan) | clean                                  | correct                                  |
| `public/` write before scan, client filename                                    | `PUBLIC` + `FILENAME` + `SCAN`         | correct true positives                   |
| Scanner error swallowed, released anyway                                        | `SCAN-ERROR`                           | correct true positive                    |
| Filename kept only as `displayName`                                             | clean                                  | correctly distinguishes display metadata |
| Quarantine → scan → publish ordering                                            | clean                                  | correct                                  |
| Content type validated via imported helper                                      | `FF-UPLOAD-MIME-001` HIGH NOT_VERIFIED | **fixed** (was a HIGH false positive)    |
| Presigned S3, private ACL, opaque key                                           | clean                                  | **no analysis performed at all**         |

The multer gate incidentally suppresses false positives, so the dominant weakness is false
negatives: any non-multer upload path receives no analysis, and its "clean" is indistinguishable
from genuinely hardened code.

### The one upload fix that was made

`FF-UPLOAD-MIME-001` fired whenever a file mentioned a content-type token and did not literally
contain `magic|signature|fileTypeFromBuffer|decode|sniff`. Content validation is routinely factored
into a shared helper whose body the in-file regex cannot read, so hardened upload paths were
published as confident HIGH failures purely because their validation lived in another module.

When the upload payload is passed to an imported function, the finding is now `NOT_VERIFIED` and its
evidence names the delegate that could not be resolved. Detection is structural — import bindings
plus an AST walk for a call receiving the payload — not a name list. Trusting client MIME with no
validation anywhere still fails, and proven in-file signature validation is still clean, so no true
positive regressed. Three regression cases cover the boundary.

This closes the confirmed false-positive class but does **not** constitute upload analyzer
completion: the three target rule families were not rewritten, no new fixtures were added for them,
and non-multer coverage is unchanged.

## Regression results

Three test files and three smoke scripts asserted the previous full-copy layout by requiring
physical duplication in every host root. They were rewritten to assert the property that matters —
canonical content exists, adapters point at it, unselected hosts remain untouched — and are stricter
than before. The installer test additionally asserts that a `claude,cursor` selector never writes
`.agents`, `.gemini`, `.github`, or `.windsurf`. No assertion was weakened to obtain a pass.

`transactions.ts`, `guard-resolution.ts`, and `managed-layout.ts` had never been linted because they
were untracked when the agents died. Linting them surfaced 8 real defects — useless regex escapes, a
provably unreachable condition, an unnecessary type assertion, two literal U+FEFF characters
embedded in regular expressions, and `Buffer` used in an `.mjs` without importing `node:buffer` —
all fixed at source.

## Command ledger

| Command                                                | Exit | Result                                           |
| ------------------------------------------------------ | ---- | ------------------------------------------------ |
| `npm test` (baseline, `3f73177`)                       | 0    | 845 tests, 844 pass, 1 skipped                   |
| `npx tsc -p tsconfig.json --noEmit` (inherited tree)   | 2    | 29 errors — 28 installer, 1 transactions         |
| `npx tsc -p tsconfig.json --noEmit` (after type fixes) | 0    | clean                                            |
| `npm run generate`                                     | 0    | 133 canonical, 276 adapters, 6 roots, 4 verbatim |
| `node --test build/cli/tests/transactions.test.js`     | 0    | 8/8 after two analyzer fixes                     |
| `node --test build/cli/tests/guard-resolution.test.js` | 0    | 11/11                                            |
| `npm test` (candidate)                                 | 0    | 867 tests, 866 pass, 0 fail, 1 skipped, 98.3 s   |
| `npx eslint .`                                         | 0    | clean                                            |
| `npx prettier --check .`                               | 0    | clean                                            |
| `npm run check:repository-identity`                    | 0    | valid, 7 generated roots                         |
| `npm run check:archives`                               | 0    | 9 archives, 1083 entries                         |
| `npm run smoke:install`                                | 0    | 46 skills, 0 symlinks                            |
| `npm run smoke:upgrade`                                | 0    | migration ok, doctor ready, clean uninstall      |
| `npm run offline:install`                              | 0    | 6 roots × 46 skills, 0 symlinks                  |
| `npm run check` (full gate)                            | 0    | all steps; secret scan 1180 files, 0 findings    |

`npm run test:coverage` and `npm audit` were **not run**. Node 20 and Node 22 were **not
exercised**; only Node 24.14.1 was used. No CI evidence was collected for the nine-job OS/Node
matrix.

## Known limitations

1. Upload analyzer completion is unimplemented. The `FF-UPLOAD-MIME-001` cross-file false-positive
   class is fixed, but the three target rule families were not rewritten structurally, no new
   fixtures were added for them, and non-multer upload paths — presigned S3/GCS, busboy, formidable,
   Next.js route handlers — remain entirely unanalysed. Their "clean" result is indistinguishable
   from genuinely hardened code, which is the more dangerous failure mode.
2. Playbook deduplication met its target on the measured metric (32.89% to 23.42% primary), but the
   metric is a proxy. Whether the shorter playbooks route an agent to
   `references/shared/evidence-rules.md` as reliably as the inlined prose did is not measured here;
   no activation or audit-quality eval was run before and after the change.
3. `FF-AUTHZ-OBJECT-001` reports HIGH on `delete({ where: { id } })` even behind a proven admin
   guard. Defensible in principle, but likely a systemic HIGH false-positive class on real
   repositories. Pre-existing; flagged rather than changed, because suppressing it when a role guard
   exists could hide genuine BOLA defects.
4. Unresolved transaction boundaries carry CRITICAL severity with LOW confidence and `NOT_VERIFIED`
   status. This satisfies "no unresolved indirection becomes a confident HIGH/CRITICAL FAIL", but it
   will inflate severity-bucketed counts in any benchmark table.
5. Several named installation lifecycle scenarios were not driven individually (see above).
6. Coverage thresholds, dependency audit, and multi-version Node behaviour are unverified.
7. No independent verification, no external benchmark, no release-readiness scoring.

## Final candidate

`71edb67943e4fddf3dd5fd9953443cc75babad5c` on `fix/complete-external-readiness`, not yet pushed, PR
#54 open and unmerged. Package version unchanged at `0.1.0`. No tag, no release.
