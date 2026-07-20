# Release notes — v0.1.8

Module applicability and report evidence ledger milestone.

This release closes a family of defects in which an unaudited module was reported in a way that read
as a positive result. Every defect was reproduced against the v0.1.7 implementation before
remediation and is covered by regression tests that fail against it.

## `NOT_APPLICABLE` now means only that a capability does not exist

`NOT_APPLICABLE` previously absorbed three unrelated situations: a capability that genuinely does
not exist, a module left out of the changed scope, and a module whose capability could not be
determined. Collapsing them lost the distinction that matters most — whether Forge looked.

Applicability is now recorded on two independent axes:

- `capability_status` answers "does this capability exist in the project?"
- `selection_status` answers "did this run audit it?"

`NOT_APPLICABLE` is reserved for a capability proven absent. A module that exists but was not
audited is `NOT_VERIFIED`, which is a statement about missing evidence rather than about the
project.

A consequence worth stating plainly: narrowing an audit can no longer switch a release gate off.
Capability ship gates read the capability axis, so a module that is present but unaudited leaves its
gate active instead of being dismissed as inapplicable.

## Behaviour change: risk-excluded modules now appear in the report

**This changes the output of `forge all audit --risk high`.**

Previously, a module below the risk threshold vanished from the report entirely. Nothing recorded
that it had gone unaudited, so its absence was indistinguishable from having been audited and found
clean. A report is a claim about what was checked, and silently dropping the modules that were not
checked makes that claim misleading.

Excluded modules now appear with:

- status `NOT_VERIFIED` — no evidence was gathered, and none is claimed
- a module decision with `selection_status: EXCLUDED_BY_RISK`
- a `capability_status` that is **not** `ABSENT`, because a risk filter proves nothing about whether
  a capability exists

If you have tooling that reads Forge reports, note the migration: **absence is no longer a signal.**
Anything that treated a missing module as "passed" must now read `module_decisions` and check
`selection_status`. Reports from `--risk high` runs will contain more entries than before.

This also required changing a pre-existing assertion in `cli/tests/cli.test.ts`, which asserted that
the `ui` module was absent from a high-risk report. That assertion encoded the old behaviour. It now
asserts the module is present, `NOT_VERIFIED`, and `EXCLUDED_BY_RISK`.

## Report schema version 2

The report gains four typed, append-only ledgers: `tools`, `planned_checks`, `runtime_evidence`, and
`module_decisions`. They are documented in [report schema](REPORT_SCHEMA.md) and rendered in both
the JSON and Markdown outputs.

The ledger APIs in `cli/src/ledger.ts` enforce one invariant throughout: **honesty only ever
decreases.** A check recorded `BLOCKED` or `NOT_RUN` can never later be rewritten as `RUN`, and
runtime evidence recorded `BLOCKED` or `NOT_VERIFIED` can never later be rewritten as `PASS`.
Re-recording a weaker outcome is allowed, because discovering that a result was less certain than
believed is a legitimate correction; the reverse is not, because the stronger claim was never
observed.

Reports written by v0.1.3 through v0.1.7 migrate in memory. Ledgers the writing release never
tracked come back empty and carry an explicit note that emptiness reflects untracked data — **not**
evidence that the corresponding checks ran or passed. The source file is never rewritten.

Migration no longer claims a v0.1.7 report was written by v0.1.6. v0.1.7 changed no report field, so
the two are indistinguishable from a report alone; the migration record names both and says why.

## The v0.1.7 offline policy is preserved

v0.1.8 introduces a coarser network-policy vocabulary for the report (`OFFLINE_SAFE`,
`NETWORK_REQUIRED`, `UNKNOWN`) alongside the v0.1.7 command vocabulary. Two vocabularies create a
laundering risk: an arbitrary audited-project command that v0.1.7 refuses to guess about could be
re-described as offline-safe on the way into the report.

`plannedCheckNetworkPolicy` is now the only sanctioned bridge, and the mapping is one-way. The two
structurally provable exemptions become `OFFLINE_SAFE`; `UNKNOWN` always stays `UNKNOWN`. There is
no inverse function and no promotion path. Absence of network keywords is not proof of offline
safety.

This was a latent type-level hazard rather than an observed defect — no production code assigned the
weaker value yet — but the wiring that would exercise it is the subject of the next milestone, so it
is closed now.

## Upgrading

No configuration changes are required. If you consume Forge reports programmatically:

- Read `schema_version`; it is now `2`.
- Stop treating a missing module as a pass. Read `module_decisions`.
- Treat an empty ledger as untracked, not as a clean result. Check `migration.absent_ledgers`.
