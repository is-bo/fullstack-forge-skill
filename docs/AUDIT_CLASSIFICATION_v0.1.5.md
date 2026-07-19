# Audit classification — v0.1.5

Every reported defect was reproduced against the untouched `df27350` baseline before any fix was
written. Classification uses `CONFIRMED`, `PARTIALLY_CONFIRMED`, `NOT_REPRODUCED`, `INVALID`, and
`NOT_VERIFIED`.

## Reported defects

| Defect                                                  | Classification | Reproduction against `df27350`                                                                                                                                                                                                                         | Resolution                                                                                                                                                                                            |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--offline` is a dead flag                              | CONFIRMED      | `options.offline` was written at `cli/src/cli.ts:555` and read nowhere. A repository-wide search for reads returned only the declaration, the default, the parse site, and the type field.                                                             | Defined and enforced offline contract in `cli/src/rendered-ui.ts`; offline state recorded in the report environment ledger and every evidence manifest; documented in `docs/CLI_REFERENCE.md`.        |
| Audited-project packages executed without authorization | CONFIRMED      | `resolveChromium(root)` used `createRequire(join(root, "package.json"))` and `await import()`ed the result. The call sat at line 76, _before_ the `--dry-run` check at line 85, and the `--allow-run` gate at line 70 covered only non-loopback hosts. | Forge-owned driver preferred; audited-project driver requires `--allow-run` plus real-path containment and is refused under `--offline`; `--dry-run` resolves and imports nothing; identity recorded. |
| Name-based SSRF protection proof                        | CONFIRMED      | `dataflow.ts:412` granted `allowlisted`/`trusted-origin`/`network-constrained` from a callee-name regex, and `isServerOwnedAllowlist` accepted any expression text matching `allowed\|trusted\|destinations\|routes` or any uppercase identifier.      | Name-based grant deleted; destination proof requires a structurally verified fixed server-owned `const` map or a dominating guard bound to the sink's tainted value.                                  |
| Rendered evidence overwritten per route and run         | CONFIRMED      | Evidence was written to `join(root, ".forge", "evidence", "ui")` with fixed `${viewport.name}.png` names, so a second route destroyed the first and a re-run destroyed its own history.                                                                | Per-revision, per-run, per-route layout with manifest, hashes, redaction, traversal containment, and partial-failure preservation.                                                                    |
| README presents an unpublished npm install              | CONFIRMED      | `README.md:62` led with `npm install --save-dev fullstack-forge-skill`; the caveat appeared only afterwards. The package is not on the npm registry.                                                                                                   | README leads with the working Git-tag install; the registry form is confined to an explicit future-publication heading and marked `NOT YET AVAILABLE`; enforced by `npm run check:install-docs`.      |

## Additional defects discovered during this pass

| Defect                                                                | Classification | Evidence                                                                                                                                                    | Resolution                                                                           |
| --------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--dry-run` imported the audited project's browser driver             | CONFIRMED      | Driver resolution preceded the dry-run branch, so a planning-only invocation executed audited-project top-level code. Not part of the reported defect list. | Dry run now returns planned paths before any resolution; covered by a sentinel test. |
| Loopback inspection imported the audited driver with no authorization | CONFIRMED      | The `--allow-run` gate applied only to non-loopback hosts, so `http://127.0.0.1:3000/` imported the project's `playwright` unconditionally.                 | All audited-project driver imports now require `--allow-run`.                        |
| URL credentials reached evidence artifacts                            | CONFIRMED      | `http://user:pass@host/` was accepted and the raw URL was written into `console.json` and finding evidence.                                                 | Credentials are rejected before any path is derived; query values are redacted.      |
| Symlinked/redirected driver packages were not contained               | CONFIRMED      | `require.resolve` was used without a real-path containment check, so a package inside the audited repo could resolve to code outside it.                    | Resolution compares `realpath` against the trust domain root and skips escapes.      |

## Verified non-regressions from v0.1.3 and v0.1.4

The following v0.1.3/v0.1.4 behaviors were re-checked and remain in force: taint survives
validation; protections stay sink-specific; SQL interpolation is still detected after Zod/UUID
validation; HTML and URL encoding do not suppress unrelated sinks; shell-separated safe execution is
still recognized; authorization requires connected subject/object evidence; unrelated policy names
do not suppress authorization findings; same-file same-sink instances remain distinct; `instance_id`
is stable across fix, block, verify, rollback, JSON, and Markdown; ship gates consume typed
evidence; secret gates do not consume SQL findings; dependency gates do not consume unrelated
sections; fixture manifests do not pollute Dependabot; coverage remains blocking; release assets
remain non-clobbering; existing immutable releases are untouched; CodeQL remains enabled and pinned;
GitHub Actions remain pinned to full immutable SHAs; historical tags are unchanged.

The existing positive SSRF case — a `const` map of fixed https literals with `redirect: "manual"` —
still suppresses the finding under the new structural rule, confirming the tightening did not simply
disable the protection path.

## Explicitly not addressed in this release

These are open product gaps, not defects introduced here. They are recorded so the release does not
imply coverage it lacks.

| Area                                                             | Status              | Reason                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changed-scope exclusions labelled `NOT_APPLICABLE`               | NOT_VERIFIED        | Distinguishing "capability absent" from "capability not selected" requires a new machine-readable applicability structure across schema, renderers, and gates. |
| CLI audit orchestration of approved checks and rendered evidence | NOT_VERIFIED        | Integrating runtime evidence into normal audit commands is a feature addition beyond this corrective patch.                                                    |
| Full `planned_checks` / `runtime_evidence` report ledger         | PARTIALLY_CONFIRMED | The `environment` ledger landed; the planned-check and runtime-evidence ledgers did not.                                                                       |
| Report-mode `--output` / `--json` contract                       | NOT_VERIFIED        | Report mode still renders to stdout only; the output-directory contract is unimplemented.                                                                      |
| Discovery evidence classes and activation weights                | NOT_VERIFIED        | Detection still lacks per-signal evidence classes, so documentation-only and test-only signals are not yet weighted apart.                                     |
