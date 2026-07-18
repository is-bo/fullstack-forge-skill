# Adding an audit module

The public `0.1.x` module set is intentionally closed at 42. Adding, removing, or renaming a module
is a compatibility change and requires a version decision before implementation.

## Source changes

1. Add one ordered entry to `config/modules.json`. The slug must be lowercase kebab-case and unique.
2. Supply concrete applicability evidence, inspection steps, executable checks, manual checks,
   finding identifiers, severities, safe fixes, approval-bound changes, verification, primary
   standards, stack guidance, and limitations. Do not add placeholders or optimistic passes.
3. Add the slug to the exact ordered list in `scripts/project.mjs` and `cli/src/constants.ts`.
4. Update discovery applicability in `cli/src/cli.ts` when the module depends on a capability.
5. Add or extend a bounded inspector only when deterministic evidence is realistic. Otherwise make
   the manual/evaluation requirement explicit.
6. Run `npm run generate`; never edit generated `forge-*` skills directly.

## Evidence and safety review

Every finding needs a stable `FF-<SECTION>-<NUMBER>` identifier and the shared fields documented in
`docs/FINDING_SCHEMA.md`. A safe fix must be local, deterministic, reversible, and policy-neutral.
Changes to identity, authorization, tenant isolation, data, migrations, secrets, money, legal text,
production, or architecture require explicit approval and must not be hidden behind `--safe`.

## Required verification

- Add a deliberately flawed fixture or evaluation prompt with expected signals.
- Add positive and negative automated tests for registry exactness and the new behavior.
- Regenerate all six platform roots and run `npm run check`.
- Run packaging and the clean installer smoke test.
- Update README tables, command docs, changelog, research/standards records, and compatibility
  notes.
- Inspect generated diffs and confirm no local specification, clone, credential, or temporary file
  is included.

Use the audit-module proposal issue template so applicability, evidence, safety, and primary sources
are reviewable before code is written.
