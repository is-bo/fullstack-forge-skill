# Adding an audit module

The public `0.1.x`/`0.2.x`/`0.3.x` module set is intentionally closed at 42 **audit** modules.
Adding, removing, or renaming a module is a compatibility change and requires a version decision
before implementation. Build mode's `forge-new` and `forge-feature` command skills are separate from
this closed set — they are not audit modules and are never counted toward or against the 42 — but
adding an audit module now also requires a matching build-guidance brief, since build mode's
discipline selection and briefs are keyed on the same slug set.

## Source changes

1. Add one ordered entry to `config/modules.json`. The slug must be lowercase kebab-case and unique.
2. Add the same ordered key to `config/module-criteria.json` and enumerate every required inspection
   criterion explicitly; broad phrases such as “check security” are not sufficient.
3. Supply concrete applicability evidence, inspection steps, executable checks, manual checks,
   finding identifiers, severities, safe fixes, approval-bound changes, verification, primary
   standards, stack guidance, and limitations. Do not add placeholders or optimistic passes.
4. Add the slug to the exact ordered list in `scripts/project.mjs` and `cli/src/constants.ts`.
5. Update discovery applicability in `cli/src/cli.ts` when the module depends on a capability.
6. Add or extend a bounded inspector only when deterministic evidence is realistic. Otherwise make
   the manual/evaluation requirement explicit.
7. Add a matching entry to `config/build-guidance.json`, keyed by the new slug (see "Build-guidance
   brief" below).
8. Run `npm run generate`; never edit generated `forge-*` skills or `references/build/<slug>.md`
   briefs directly.

## Build-guidance brief

`config/build-guidance.json` is a hand-authored map from audit-module slug to a build-time brief:
`title`, `decideBeforeCoding` (decisions to make before writing code for that discipline), and
`evidenceToProduce` (what to capture while building it). `scripts/generate-build.mjs` renders each
entry to `src/fullstack-forge/references/build/<slug>.md`, capped at 60 rendered lines — the
generator throws if a brief would exceed that budget, so keep entries concrete and short rather than
exhaustive.

`validateGuidanceMap` (in `scripts/lib/build-generator.mjs`) rejects any slug in
`config/build-guidance.json` that is not a real audit-module slug, and a dedicated test
(`scripts/tests/build-generator.test.mjs`, "build-guidance coverage: all 42 briefs are present")
enforces exact slug-set equality against the 42 audit modules — CI fails if the guidance map ever
regresses to partial coverage or gains an entry the audit catalog does not have. A new audit module
without a matching brief fails that test, not silently ships with a gap.

## Evidence and safety review

Every finding needs a stable `FF-<SECTION>-<NUMBER>` identifier and the shared fields documented in
`docs/FINDING_SCHEMA.md`. A safe fix must be local, deterministic, reversible, and policy-neutral.
Changes to identity, authorization, tenant isolation, data, migrations, secrets, money, legal text,
production, or architecture require explicit approval and must not be hidden behind `--safe`.

## Build producer and gate interfaces

Adding an audit module does not automatically grant any Build evidence authority. If the discipline
needs an executable Build criterion, make all four changes together:

1. Add an exact producer entry in `cli/src/build-producers.ts`. A project-command producer is keyed
   by both detected script name and exact criterion; give it a stable Forge-owned producer ID,
   discipline, security-control classification, and the existing producer version/contract. Do not
   add wildcards, caller-provided producer names, shell strings, or a generic “command exited 0”
   promotion path.
2. Add the criterion to the applicable gate in `cli/src/build-gates.ts`, including its tier,
   applicability trigger, and `never`, `advisory`, or `operational-human` waiver policy. Required
   safety, correctness, data, migration, recovery, accessibility, and high-tier criteria should be
   non-waivable. The gate planner is pure; command authorization and execution stay in the producer
   layer.
3. Add positive, negative, unavailable-producer, wrong-criterion, stale-input, cross-root/revision,
   expiry, and tampered-envelope tests. A `PASS` must bind a complete non-empty input/artifact
   manifest; `NOT_APPLICABLE` is reserved for the applicability producer and cannot satisfy a
   required gate.
4. Add or update a public prevention evaluation with a fixed task, materializable starting
   repository, expected applicability and gates, forbidden defects, required validation artifacts,
   and honest classification of deterministic, nondeterministic, human-required, and unsupported
   external-tool checks.

Internal producers are for fixed in-process adapters only. They accept no caller-provided code and
belong in `BUILD_INTERNAL_PRODUCER_REGISTRY`. A new runtime adapter must use a finite action/state
model, bind credential-free routes and observed role/state/viewport context, hash every artifact,
and leave partial or unavailable evidence `NOT_VERIFIED`/`BLOCKED`. Never expose a public API that
lets a state file register its own producer or gate.

## Required verification

- Add a deliberately flawed fixture or evaluation prompt with expected signals.
- Add positive and negative automated tests for registry exactness and the new behavior.
- Regenerate the six project-host adapter roots plus the package-local Codex plugin `skills/` root,
  and run `npm run check`.
- Run packaging and the clean installer smoke test.
- Update README tables, command docs, changelog, research/standards records, and compatibility
  notes.
- Inspect generated diffs and confirm no local specification, clone, credential, or temporary file
  is included.

Use the audit-module proposal issue template so applicability, evidence, safety, and primary sources
are reviewable before code is written.
