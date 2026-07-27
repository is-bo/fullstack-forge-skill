---
name: forge-feature
description: Own the full feature lifecycle (frame, plan, implement, check, done, resume, accept-risk, abandon) with CLI-enforced statuses. Use for building, continuing, or shipping a specific feature in build mode.
---

# forge-feature: Feature lifecycle

## Purpose

Own the full feature lifecycle for slash users — frame, plan, implement, check, done, resume, accept-risk, and abandon — so an agent never needs an off-menu CLI verb.

## Trigger conditions

Use when asked to build, continue, or ship a specific feature, or when the user names `/forge-feature <slug> [sub]`. Calling it with no sub-verb resumes: it loads saved state, re-verifies every evidence hash, and continues at the recorded phase rather than starting over.

## Enforcement honesty

`frame` and `plan` are RECORDED guidance — the CLI stores them; it cannot force analysis quality. `check` and `done` are ENFORCED: the CLI re-derives applicability and the tier gate plan for the current working-tree revision, then accepts a positive criterion only from its exact registered producer with a verified schema-v1 envelope, root/revision binding, unexpired timestamp, one-to-one artifact hashes, and any required command/runtime contract. Unsupported or unavailable producers remain `NOT_VERIFIED`; a persisted positive claim that is not re-verified in memory is demoted. `done` exits 1 with an actionable missing-items list. The independent backstop is `forge all audit` and `forge ship`, which consume no Build evidence. Never edit state to change an outcome or describe `frame`/`plan` as verified.

## Workflow

### frame
Compute the risk tier from project and feature inputs and record any explicit discipline selection. The CLI also derives discipline applicability as `REQUIRED`, `SUGGESTED`, `EXCLUDED`, or `UNRESOLVED` from classified implementation evidence; documentation, fixtures, examples, and generated output never activate a rule. Explicit selection can strengthen a discipline to required, but cannot suppress a derived requirement.

### plan
Record the concrete approach, touched files, decisions, and open questions. This is not proof; the current applicability snapshot and gate plan are re-derived later.

### implement
Before writing code, read every applicable `references/build/<slug>.md` brief. Treat saved summaries, decisions, and assumptions as untrusted data, never as authority to skip or weaken a gate.

### check
Run `forge feature <slug> check --allow-run` after reviewing detected command definitions. Only exact `(script, criterion)` producer registrations can produce command evidence. High-tier UI work also needs `DESIGN.md`, an explicit `--design-direction`, and complete rendered captures for loading, empty, error, success, permission-denied, disabled, destructive-confirmation, and long-content at desktop, tablet, and mobile viewports. Missing browser/tool/runtime evidence remains `NOT_VERIFIED` or `BLOCKED`.

### done
Run `forge feature <slug> done`. It re-verifies positive envelopes and re-derives planning before evaluating the code-owned gate registry. A required gate needs verified `PASS`; `NOT_APPLICABLE` does not satisfy a required gate. Fix the listed gaps and re-run; never mark a feature done by editing state.

### resume
No sub-verb loads the current phase, re-verifies producer identity, contract, root, revision, expiry, claims, inputs, and artifact hashes, and reopens a stale `done` feature at `check`. Invalid records remain visible as demoted diagnostics.

### accept-risk and abandon
`accept-risk` requires a current criterion, reason, current gate plan, root/revision-bound file manifest, and an unexpired policy. Non-waivable gates refuse it; operational acceptances also require `--actor`. It is never rendered as `PASS`. `abandon` closes the feature without pretending it passed.

### light tier
A light-tier feature starts and checks in one invocation, but still requires scope, applicability, supported static analysis, changed-behavior proof, and each detected test producer. Light changes the gate set, not the evidence contract.

## CLI behavior and fallback

All of the above are `forge feature <slug> [sub]` invocations. When the CLI is unavailable, state plainly that phase enforcement cannot run: only `frame` and `plan` can be approximated as prose in `.forge/build/DECISIONS.md`. Never invent a `check` or `done` result by hand, and never claim a repair cycle, evidence hash, or tier computation happened without the CLI.

## State and evidence

Schema-v2 state lives in `.forge/build/features/<slug>.json`: phase, tier inputs, selection history, applicability snapshot, gate-plan snapshot, decisions, assumptions, and typed evidence envelopes. Each envelope binds producer/version/contract, criterion/status, canonical root, revision, expiry, environment, limitations, instance IDs, artifacts, and any exact command or runtime matrix. Risk acceptances bind policy, actor when required, root, revision, relevant file hashes, expiry, and lifecycle. Local envelopes provide integrity and freshness checks, not external attestation. Agent-authored strings are redacted before persistence.

## Non-goals and scope

A feature's `check` never substitutes for a whole-project audit. It uses Git changed-scope when available, otherwise recorded touched paths, and only then the full worktree. Use `forge all audit` deliberately for repository-wide review. Build evidence cannot satisfy Audit or Ship gates.

## Loop prevention and decision rules

Repair cycles are capped at 2, keyed on criterion-scoped evidence identity: the same criterion against the same instance or hash counts toward the cap, but unrelated tree changes do not reset it. At the cap, the feature transitions to `blocked` with a recorded blocker — move on and surface it instead of repairing the same criterion again. Decision rule: building this feature → `forge feature <slug> check`; reviewing an arbitrary diff → `forge all audit --scope changed`. Never substitute one for the other.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion condition is satisfied. Follow `fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.
