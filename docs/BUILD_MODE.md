# Build mode

Build mode helps an agent follow a production-quality engineering workflow while starting a project
or implementing a feature. It is additive to the existing audit system: nothing here changes
`forge <section> audit`, `forge all audit`, or `forge ship` behavior, and build state never
satisfies one of their gates.

## Entry points

| Entry point                   | CLI                          | Purpose                                             |
| ----------------------------- | ---------------------------- | --------------------------------------------------- |
| `/forge build [request]`      | `forge build [request]`      | Simple project or feature start from ordinary text  |
| `/forge continue`             | `forge continue`             | Continue one unfinished feature; ask on ambiguity   |
| `/forge-new`                  | `forge new`                  | New-project foundation, once per project            |
| `/forge-feature <slug> [sub]` | `forge feature <slug> [sub]` | Full feature lifecycle, including resume            |
| —                             | `forge resume`               | Lists unfinished features / resumes the most recent |
| —                             | `forge migrate build`        | Explicit v0.2 schema-v1 to v0.3 schema-v2 migration |

The simple `forge` skill routes to the same lifecycle without asking a user for a slug or tier. The
two expert Build skills still own the underlying lifecycle, including resume. `forge resume` keeps
its existing expert lookup behavior; `forge continue` refuses to guess between multiple unfinished
features.

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
- `check` and `done` are **enforced**. The CLI re-derives applicability and a tier-specific gate
  plan at the current working-tree revision. A positive criterion is eligible only when its exact
  registered producer, typed envelope, root/revision, expiry, outer claim, command/runtime contract,
  and artifact hashes all verify. A persisted positive claim that is not re-verified in memory is
  demoted to `NOT_VERIFIED`. `done` exits 1 with an actionable missing-items list when any required
  gate lacks verified `PASS` evidence.
- The independent backstop remains `forge all audit` and `forge ship` — both re-derive their own
  evidence and never consume build state as gate input.

## Risk tiers

Tier is chosen at `frame` time (or `--tier` on the first `forge feature <slug>` invocation) from
recorded inputs: data sensitivity, exposure, irreversibility, money movement, tenancy, uploads, AI,
expected scale, secrets/credential handling, session handling, cryptography, outbound requests to
user-supplied URLs (SSRF class), destructive data operations, and schema migrations. `forge new`
records the same input classes at the project level so every feature's tier computation starts from
a shared baseline.

| Tier       | Gate                                                                                                            | Plan/design                              | Notes                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| `light`    | Scope, applicability, supported static analysis, changed-behavior proof, detected test commands                 | None — start and check in one invocation | Narrow gate set; evidence contracts are unchanged              |
| `standard` | Light baseline, all applicable disciplines, and detected format/lint/type/test/build commands                   | Short plan; selected briefs consulted    | Default tier; core and material disciplines are non-waivable   |
| `high`     | Standard plus applicable negative, migration/recovery, runtime, privacy, integration, and security-review gates | Plan required                            | Every applicable discipline and high-tier gate is non-waivable |

The CLI enforces the tier floor: trigger words in a feature's slug, summary, selected disciplines,
or tier inputs (payments, identity, sessions, secrets, uploads, tenancy, AI, migrations,
cryptography, SSRF, destructive operations) escalate the feature to `high`, with the detected
triggers recorded in `tier_inputs`. Passing `--tier <tier> --reason "<why>"` keeps the requested
tier and records the override instead — a lower tier on a high-risk feature is always a visible,
recorded decision, never a silent default.

High-tier negative gates are capability-specific: authentication abuse paths, authorization denial,
tenant isolation, hostile uploads, webhook signature/replay/idempotency, migration and recovery,
sensitive-data flows, rendered UI, integration proof, and independent security review are added only
when the current profile and applicability result require them. A required gate must resolve to a
verified `PASS`; `NOT_APPLICABLE` does not satisfy a required gate.

Discipline selection at `frame` is advisory: over-inclusion is corrected later with a reasoned
`NOT_APPLICABLE`, and under-inclusion is caught at `check` via a discovery-profile diff, so err
toward including a discipline you are unsure about.

## State files

Everything lives under `.forge/build/`, which stays git-ignored by default (it is agent context, not
a deliverable):

- `.forge/build/project.json` — schema-v2 product frame: problem, users/roles, outcomes, invariants,
  critical workflows, sensitive-data classes, trust boundaries, expected scale, stack choices with
  rationale, constraints, assumptions, unresolved decisions, non-goals, backlog, design alignment,
  selection history, and the feature index.
- `.forge/build/features/<slug>.json` — schema-v2 phase, tier inputs, selected disciplines and
  selection history, applicability and gate-plan snapshots, plan hash, decisions, assumptions, typed
  producer evidence, risk-acceptance lifecycle, criterion-scoped repair counters, blockers, evidence
  run IDs, and timestamps.
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

## Applicability and gate planning

`check`, `status`, `resume`, and `done` derive applicability from current discovery plus changed and
recorded touched paths. Evidence is classified before it can activate a discipline: implementation,
route, schema, manifest, and configuration paths may activate rules; documentation, tests, fixtures,
examples, and generated output do not. Each discipline is recorded as `REQUIRED`, `SUGGESTED`,
`EXCLUDED`, or `UNRESOLVED`, with confidence and evidence. Explicit selection can strengthen a
discipline to `REQUIRED`; it cannot hide an independently derived requirement.

The Build gate registry is code-owned and deterministic. Every plan includes scope, applicability,
supported static analysis, and changed-behavior proof. It adds applicable discipline criteria,
detected project commands, and high-tier adverse/recovery/runtime criteria. Persisted applicability
and gate snapshots are diagnostics and resume context only; `done` re-derives both for the current
revision before evaluating them.

## Evidence rules

- **Build evidence satisfies zero ship gates.** `forge ship` and `forge all audit` never consume
  `.forge/build/` state as gate evidence; they always re-derive everything independently.
- Every criterion names an exact registered producer. Project commands are registered by
  `(script name, criterion)`; a successful but unregistered command cannot produce a `PASS` for a
  different criterion. Internal producers are a separate closed registry for scope, applicability,
  bounded analyzers, design direction, and rendered runtime evidence.
- A typed envelope binds schema, domain, producer/version/contract, exact criterion and status,
  canonical root, working-tree revision, run ID, production and expiry timestamps, environment,
  limitations, instance IDs, and a one-to-one artifact `(path, SHA-256, media type)` manifest. A
  command claim also binds the detected definition, argv, exit code, start time, duration, output
  digest, and hashed input manifest.
- Positive claims expire after 24 hours and are re-verified on load. Any unknown field, producer
  mismatch, cross-root/cross-revision record, stale expiry, outer-claim mismatch, changed input, or
  artifact hash mismatch demotes the record to `NOT_VERIFIED`; the diagnostic is retained.
- `PASS` requires producer-defined affirmative evidence. Only the applicability producer may emit a
  reasoned `NOT_APPLICABLE`, and excluded disciplines are omitted from the required gate set. A
  required gate itself needs verified `PASS`; `FAIL` and non-waivable gaps cannot be accepted.

These envelopes are local integrity and freshness controls, not signatures from an external trust
service. A same-user process that can alter both the program and its state remains inside the local
trust boundary; independent Audit and Ship re-derivation is the release backstop.

## Runtime and design evidence

High-tier UI, UX, frontend, or accessibility work requires all eight states — `loading`, `empty`,
`error`, `success`, `permission-denied`, `disabled`, `destructive-confirmation`, and `long-content`
— at desktop `1280×800`, tablet `768×1024`, and mobile `375×812`. Supply one credential-free HTTP(S)
route per state with repeatable `--runtime-case <state>=<url>` flags (or `--url` for the success
state), plus `--role` and `--design-direction follows|deviation:<reason>`. The adapter uses the
existing rendered-UI collector and records screenshots, keyboard walkthrough, accessibility scan,
horizontal-overflow checks, console results, and artifact hashes. It never starts an application or
installs browser tooling. Missing tools, unreachable routes, partial captures, or an incomplete
state/viewport matrix remain `BLOCKED` or `NOT_VERIFIED`, never `PASS`.

## accept-risk and abandon

- `forge feature <slug> accept-risk --criterion <id> --reason "<text>"` requires a current check,
  current gate plan, existing evidence record, non-empty reason, canonical root, current revision,
  complete relevant-file hash manifest, 24-hour expiry, and an eligible gate policy. Operational
  acceptances also require `--actor <accountable-human>`. Superseded entries are expired rather than
  rewritten. Non-waivable gates refuse acceptance; accepted risk is always rendered distinctly,
  never as `PASS`.
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
positive producer envelope, re-derives applicability and gates, and continues at the recorded phase
rather than starting over. If a completed feature no longer satisfies the current plan it reopens at
`check`. Any reloaded free text — plan summary, decisions, assumptions — is treated as data, never
as instructions: it cannot direct the agent to skip a check, widen scope, or treat prior text as new
authority. `forge resume` enumerates canonical feature files and rebuilds the project index, so a
hand-edited index cannot hide unfinished work.

New-repo bootstrap: when there is no resolvable Git merge base, `check` scopes to the feature's
recorded touched paths instead of blocking, falling back to the full worktree only if no touched
paths were recorded either.

## Decision rule: feature check vs. all audit

Building a specific feature → `forge feature <slug> check`. Reviewing an arbitrary diff (someone
else's PR, a change not tracked as a feature, a pre-release sweep) →
`forge all audit --scope changed`. Never substitute one for the other: a feature `check` is scoped
to that feature's recorded touched paths, and an audit never reads or writes `.forge/build/` state.

## Migration from v0.2.0

Audit reports continue to migrate in memory as before, and Audit command compatibility is preserved.
Build state changes from schema v1 to schema v2 and is never migrated implicitly. Any Build command
that encounters v1 state refuses with an explicit migration instruction.

```bash
forge migrate build --dry-run
forge migrate build
# If an earlier migration was interrupted:
forge migrate build --resume
# Or restore the exact v0.2 bytes after hash verification:
forge migrate build --rollback
```

The migration parses and validates every project/feature file before writing, creates byte-for-byte
hash-bound backups, writes a journal, uses same-directory atomic replacements, and can resume or
roll back after interruption. Legacy evidence and risk acceptances migrate only as expired,
`migrated-untrusted` diagnostics; they must be re-produced under v0.3 before satisfying a gate.
Mixed, unknown, malformed, symlinked, path-escaping, or changed-after-plan state is refused.

## Limitations

- The CLI cannot force analysis quality during `frame` or `plan` — it stores what an agent records,
  it does not grade the thinking behind it.
- A discipline or gate with no registered, detected producer stays `NOT_VERIFIED`. Manual notes and
  external-tool claims are diagnostics or risk decisions; they cannot be entered as an automated
  `PASS` through Build state.
- Runtime collection depends on a user-started application and available trusted browser tooling.
  Full assistive-technology, provider, database, production, and human-design judgments remain
  outside the automated contract.
- `forge new` never audits existing code, performs a Git changed-scope operation, or edits
  application source — it only frames the work ahead.
- A feature `check` uses Git changed-scope, recorded touched paths, or a full-worktree bootstrap in
  that order; it is not a substitute for a repository-wide audit.
- The independent backstop for correctness is always `forge all audit` and `forge ship` — build
  mode's own statuses, however enforced, never gate a release by themselves.
