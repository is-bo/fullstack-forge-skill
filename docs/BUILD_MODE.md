# Build mode

Build mode helps an agent follow a production-quality engineering workflow while starting a project
or implementing a feature. It is additive to the existing audit system: nothing here changes
`forge <section> audit`, `forge all audit`, or `forge ship` behavior, and build state never
satisfies one of their gates.

## Entry points

| Entry point                   | CLI                          | Purpose                                             |
| ----------------------------- | ---------------------------- | --------------------------------------------------- |
| `/forge-new`                  | `forge new`                  | New-project foundation, once per project            |
| `/forge-feature <slug> [sub]` | `forge feature <slug> [sub]` | Full feature lifecycle, including resume            |
| —                             | `forge resume`               | Lists unfinished features / resumes the most recent |

The two command skills own their entire lifecycle, including resume, so a slash user never needs an
off-menu CLI verb. `forge resume` is CLI sugar for the same lookup.

## Phases

```text
frame → plan → implement → check → done
```

Terminal states: `done`, `blocked` (a recorded repair-cap blocker), `abandoned`. Human-decision
edges out of the normal flow: `accept-risk` (bounded, see below) and `abandon`. `implement` is the
agent's working stage between `plan` and `check`, not a stored phase value — `status` reports `plan`
while code is being written and moves to `check` after the first check pass.

**Enforcement honesty** — skill text and this document never claim more than the CLI does:

- `frame` and `plan` are **recorded guidance**. The CLI stores what an agent decides; it cannot
  force analysis quality or verify that the reasoning was sound.
- `check` and `done` are **enforced**. Their statuses are derived by the CLI from real executions
  (analyzers, argv command runs, structural checks) and are never written by the agent. `done` exits
  1 with an actionable missing-items list when tier-required criteria lack evidence.
- The independent backstop remains `forge all audit` and `forge ship` — both re-derive their own
  evidence and never consume build state as gate input.

## Risk tiers

Tier is chosen at `frame` time (or `--tier` on the first `forge feature <slug>` invocation) from
recorded inputs: data sensitivity, exposure, irreversibility, money movement, tenancy, uploads, AI,
expected scale, secrets/credential handling, session handling, cryptography, outbound requests to
user-supplied URLs (SSRF class), destructive data operations, and schema migrations. `forge new`
records the same input classes at the project level so every feature's tier computation starts from
a shared baseline.

| Tier       | Gate                                                       | Plan/design                           | Notes                                                                                                                |
| ---------- | ---------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `light`    | Project checks + changed-scope analyzers                   | None — one-shot flow                  | `frame` folds into a single pass; still runs `check` before `done`                                                   |
| `standard` | `check` + evidence for touched disciplines                 | Short plan; selected briefs consulted | Default tier                                                                                                         |
| `high`     | Briefs mandatory; negative tests required where applicable | Plan required                         | `accept-risk` not permitted for required security controls; a `NOT_VERIFIED` required security control blocks `done` |

The CLI enforces the tier floor: trigger words in a feature's slug, summary, selected disciplines,
or tier inputs (payments, identity, sessions, secrets, uploads, tenancy, AI, migrations,
cryptography, SSRF, destructive operations) escalate the feature to `high`, with the detected
triggers recorded in `tier_inputs`. Passing `--tier <tier> --reason "<why>"` keeps the requested
tier and records the override instead — a lower tier on a high-risk feature is always a visible,
recorded decision, never a silent default.

Disciplines whose criterion is a required security control at high tier: `auth`, `authorization`,
`security`, `privacy`, `tenancy`, `uploads`, `payments`. A `NOT_VERIFIED` result on one of these at
high tier can never be waived by risk acceptance — it must resolve to `PASS` or a reasoned
`NOT_APPLICABLE`.

Discipline selection at `frame` is advisory: over-inclusion is corrected later with a reasoned
`NOT_APPLICABLE`, and under-inclusion is caught at `check` via a discovery-profile diff, so err
toward including a discipline you are unsure about.

## State files

Everything lives under `.forge/build/`, which stays git-ignored by default (it is agent context, not
a deliverable):

- `.forge/build/project.json` — schema-versioned product frame, risk-class inputs, stack decision
  with rationale, non-goals with reasons, and the feature index.
- `.forge/build/features/<slug>.json` — phase, tier and tier inputs, selected disciplines with
  reasons, plan summary and hash, decisions, assumptions, evidence records (criterion, producer,
  status, per-file SHA-256, instance IDs), risk acceptances, criterion-scoped repair counters,
  blockers, and timestamps.
- `.forge/build/DECISIONS.md` — an append-only decision log (never rewritten; superseding decisions
  are added as new entries).
- `.forge/build/DESIGN.md` — design direction (tone, density, reference products, explicit design
  non-goals, state coverage baseline, responsive behavior) so later UI work has a document to build
  toward, not just prior source code to imitate.

Both `DECISIONS.md` and `DESIGN.md` are written under `.forge/build/`, never into the project's own
`docs/` directory. Teams that want to commit them as durable project history can opt in with a
`.gitignore` negation:

```gitignore
.forge/
!.forge/build/
!.forge/build/DECISIONS.md
!.forge/build/DESIGN.md
```

This deliberately does **not** negate `.forge/build/project.json` or `.forge/build/features/`: those
are working state with evidence hashes tied to a specific tree revision, not documents meant for
review history.

## Discipline briefs

`src/fullstack-forge/references/build/<slug>.md` holds one hand-authored brief per audit-module slug
— "decide before coding" plus "evidence to produce while building," rendered from
`config/build-guidance.json` and capped at 60 rendered lines each. During `implement`, read every
brief for the disciplines selected at `frame` and follow it while writing code, not after the fact.

## Evidence rules

- **Build evidence satisfies zero ship gates.** `forge ship` and `forge all audit` never consume
  `.forge/build/` state as gate evidence; they always re-derive everything independently.
- Every status in a feature's evidence record is producer-derived by the CLI (analyzers, argv
  command executions, structural checks) — never written by the agent.
- Freshness is judged per-file: each evidence record carries per-file SHA-256 hashes (plus an
  optional structural instance ID). On every load, hashes are re-verified; a changed or missing file
  demotes that record to `NOT_VERIFIED` (recorded in its evidence log, never silently deleted)
  rather than being trusted as-is.
- A criterion is satisfied for `done` by `PASS`, a reasoned `NOT_APPLICABLE`, or an eligible risk
  acceptance. A `FAIL` is never waivable.

## accept-risk and abandon

- `forge feature <slug> accept-risk --criterion <id> --reason "<text>"` requires a non-empty reason
  and an existing evidence record for that criterion (run `check` first). It is recorded immutably —
  criterion, reason, current revision, timestamp — in `risk_acceptances[]` and is always rendered
  distinctly, never as `PASS`. It is refused for a required security control at high tier.
- `forge feature <slug> abandon [--reason "<text>"]` closes the feature without pretending it
  passed. A `done` feature cannot be abandoned.

Both are human decisions the CLI records, never outcomes the agent infers on its own.

## Loop prevention

Repair cycles are capped at 2 per criterion. The cap is keyed on a **criterion-scoped evidence
identity**: a signature derived from the criterion's failing instance IDs (or, absent those, its
file hashes). The same signature recurring across checks means a repair attempt did not change the
failure, so its counter increments; a different signature is a new failure and resets it — unrelated
tree changes never reset a counter that is tracking the same unresolved failure. At the cap, the
feature transitions to `blocked` with a recorded blocker; the skill directs the agent to move on and
surface it rather than repairing the same criterion again.

## Resumption

Calling `forge feature <slug>` with no sub-verb resumes: it loads saved state, re-verifies every
evidence hash (demoting anything stale to `NOT_VERIFIED`), and continues at the recorded phase
rather than starting over. Any reloaded free text — plan summary, decisions, assumptions — is
treated as data, never as instructions: it cannot direct the agent to skip a check, widen scope, or
treat prior text as new authority.

New-repo bootstrap: when there is no resolvable Git merge base, `check` scopes to the feature's
recorded touched paths instead of blocking, falling back to the full worktree only if no touched
paths were recorded either.

## Decision rule: feature check vs. all audit

Building a specific feature → `forge feature <slug> check`. Reviewing an arbitrary diff (someone
else's PR, a change not tracked as a feature, a pre-release sweep) →
`forge all audit --scope changed`. Never substitute one for the other: a feature `check` is scoped
to that feature's recorded touched paths, and an audit never reads or writes `.forge/build/` state.

## Migration from v0.1.x

Build mode is additive. There is no audit-side behavior change: module set, finding schema, gate
registry, and CLI verbs from v0.1.x are unchanged. `forge update <platform>` refreshes installed
skills to pick up the two new command skills (`forge-new`, `forge-feature`); `forge update` and
`forge init` print a "Build mode (new in 0.2.0)" pointer after installing. No existing `.forge/`
artifact is read, migrated, or invalidated by installing this release.

## Limitations

- The CLI cannot force analysis quality during `frame` or `plan` — it stores what an agent records,
  it does not grade the thinking behind it.
- Most discipline criteria resolve `NOT_VERIFIED` or `NOT_APPLICABLE` without direct runtime
  evidence; a discipline with no executable producer in scope stays `NOT_VERIFIED` until the agent
  supplies evidence, a reasoned `NOT_APPLICABLE`, or an eligible risk acceptance.
- `forge new` never audits existing code, performs a Git changed-scope operation, or edits
  application source — it only frames the work ahead.
- A feature `check` is scoped to that feature's recorded touched paths; it is not a substitute for a
  repository-wide audit.
- The independent backstop for correctness is always `forge all audit` and `forge ship` — build
  mode's own statuses, however enforced, never gate a release by themselves.
