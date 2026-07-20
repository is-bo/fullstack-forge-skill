# Release notes — v0.1.10

Discovery evidence classification and specification traceability milestone.

Two things a report can get wrong without ever looking dishonest: claiming a capability exists
because a word appeared somewhere, and claiming compliance nobody can check. This release closes
both.

## Discovery records what kind of evidence each signal is

Previously a capability keyword was a capability keyword. A mention of Stripe in a README, in a test
fixture, in a generated platform copy of Forge's own skills, or in a code comment counted exactly as
much as an actual payment integration. The result was a profile that activated modules for
capabilities the project did not have, and an audit that then reported on them.

Every detection now records an evidence class — `manifest`, `implementation`, `configuration`,
`route`, `schema`, `test`, `documentation`, `fixture`, `generated`, `example`, or `unknown` —
together with the path and line it came from, a confidence, an activation weight, a reason, and the
workspace it belongs to.

Only production-bearing evidence activates a capability:

- Documentation, tests, fixtures, and generated Forge or platform copies carry **zero** activation
  weight. They are recorded as observed, and they never activate anything.
- Examples are separated from active applications and carry a small fraction of a weight.
- Keywords found in comments or passive string literals are downgraded.

## `UNKNOWN` is now a real answer

Capability determination used to be boolean: any signal meant present, no signal meant absent.
Neither could express the most common truth, which is that there was not enough evidence to decide.

Determination now returns `PRESENT`, `ABSENT`, or `UNKNOWN` against an explicit activation
threshold. A pile of weak signals produces `UNKNOWN` instead of a false `PRESENT`, and silence
produces `UNKNOWN` instead of a false `ABSENT`.

Assessments are computed per workspace and published in `.forge/project-profile.json` as
`capability_assessments`. Existing language, framework, and structured discovery is unchanged.

## Applicability now reads assessments

Module applicability prefers a capability assessment over the legacy presence map.
`capabilityStatusFor` projects a `CapabilityAssessment` onto the v0.1.8 module-decision capability
axis, and `decisionFindingStatus` remains the canonical mapping to `NOT_APPLICABLE` and
`NOT_VERIFIED`.

The projection never strengthens a claim. This matters more than it may sound: v0.1.8 exists
precisely to stop `NOT_APPLICABLE` from meaning anything other than "this capability provably does
not exist", and projecting an `UNKNOWN` assessment as `ABSENT` would have quietly resurrected that
defect. So:

- `UNKNOWN` stays `UNKNOWN` and is never reported as a proven absence.
- Across a monorepo, `PRESENT` in any workspace wins.
- `ABSENT` requires **every** workspace to prove absence. Absence in one workspace is not absence in
  the project.

A capability the evidence layer does not model produces no assessment, and that silence is not read
as evidence. The layer models sixteen capabilities while module decisions are gated on twenty-four;
the other eight continue to use the legacy presence map rather than being reported `UNKNOWN`
forever.

## Specification traceability is published and machine-checked

A public traceability matrix records every authoritative requirement in the maintainers' own words,
with implementation, test, documentation, and release-verification evidence, a status, and honest
limitations. No private specification wording is quoted, reproduced, or referenced.

`config/traceability-matrix.json` is the source of truth and `docs/TRACEABILITY_MATRIX.md` is
generated from it. `npm run check:traceability` runs inside `npm run check`, and therefore inside
CI, rejecting:

- duplicate or non-dense requirement identifiers
- unsupported statuses
- referenced repository paths that do not exist
- `COMPLIANT` entries with no implementation or no test/documentation evidence
- `NON_COMPLIANT` or `NOT_APPLICABLE` entries with no stated reason
- `NOT_VERIFIED` entries that do not distinguish a genuine external limit from unfinished local work

Current matrix: **75 requirements — 37 `COMPLIANT`, 36 `PARTIALLY_COMPLIANT`, 2 `NOT_VERIFIED`**,
with **zero integration placeholders**.

## Corrected attributions

The matrix previously carried four `integration:` placeholders whose attributions were self-declared
inference. All four are replaced with the exact merged files, tests, documentation, and release
evidence, and two were simply wrong:

- **`FF-MOD-15`** (static security analyzer) belongs to **v0.1.7 / PR #19**, not v0.1.9.
  `cli/src/analyzers.ts` first landed in `c8073ed` on the offline-security branch.
- **`FF-ORCH-01`** (repository-wide orchestrator) belongs to **v0.1.8 / PR #20** and **v0.1.9 / PR
  #21**, not v0.1.7.

Every remaining attribution was re-checked against the commit that introduced each referenced file
rather than trusted.

The two remaining `NOT_VERIFIED` entries are genuinely external: both are GitHub-hosted repository
settings that cannot be proven from repository contents.

## Upgrading

`.forge/project-profile.json` gains a `capability_assessments` array. Existing fields are unchanged,
and tooling that ignores unknown fields is unaffected. If you have tooling that inferred capability
presence from the legacy `capabilities` map, note that a capability may now be reported `UNKNOWN`
where it was previously inferred present from weak evidence.

See [the traceability overview](TRACEABILITY.md) and
[the release verification record](RELEASE_VERIFICATION_v0.1.10.md).
