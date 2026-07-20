---
name: forge-new
description: Guide the new-project foundation workflow that frames product, users, business rules, risk class, stack rationale, non-goals, design direction, and an initial feature list. Use for starting a new product or codebase in build mode.
---

# forge-new: New project foundation

## Purpose

Guide an agent through the new-project foundation workflow: product frame, users and roles, business rules, risk class, stack decision with rationale, explicit non-goals, design direction, and an initial feature list — recorded durably so `/forge-feature` can pick up where this leaves off.

## Trigger conditions

Use when a request starts a new product or project, asks to scaffold or kick off build mode, or names `/forge-new`. Run it once per project; re-run only to revise the recorded frame, since `forge new` appends to `DECISIONS.md` rather than erasing prior entries.

## Enforcement honesty

Every phase here is RECORDED guidance, not an enforced gate. The CLI stores what you decide; it cannot force you to think it through, and nothing in this workflow produces a PASS or FAIL. The independent backstop for correctness is `forge feature <slug> check` for a specific feature, and `forge all audit` or `forge ship` for the whole repository. Never describe this workflow as having verified anything — it frames decisions for later enforcement.

## Workflow

Work through these in order, recording each as you go:

1. Product frame — one paragraph: what the product does, for whom, and the single most important outcome.
2. Users and roles — every role, including anonymous or public, and what each can do.
3. Business rules — the non-negotiable invariants (ownership, uniqueness, money, lifecycle) stated as testable sentences.
4. Risk class inputs — data sensitivity, exposure, irreversibility, money movement, tenancy, uploads, AI, expected scale, secrets and credential handling, session handling, cryptography, outbound requests to user-supplied URLs (SSRF class), destructive operations, and schema migrations. Record which apply and why; this seeds every feature's tier computation later.
5. Stack decision with rationale — name the stack and the concrete reason (team familiarity, deployment target, data shape, latency needs), never a default picked without one.
6. Explicit non-goals — state infrastructure the product does NOT need yet, with the reason. A justified 'no Redis, no queue, and no microservices split at this stage' is a correct, complete answer, not a gap. Revisit a non-goal when a later feature's `check` surfaces evidence that contradicts it.
7. Design direction — capture the intended visual and interaction direction in `DESIGN.md` (tone, density, reference products, explicit design non-goals) so later UI work has a document to build toward, not just prior source code to imitate.
8. Initial feature list — a short backlog in priority order; each item becomes a `/forge-feature <slug>` later.

## CLI behavior and fallback

When the CLI is installed, `forge new` runs this workflow and writes `.forge/build/project.json` (schema-versioned frame, risk-class inputs, stack decision, non-goals with reasons, and the feature index), `.forge/build/DECISIONS.md` (an append-only decision log), and `.forge/build/DESIGN.md` (design direction) from the canonical templates.

If the CLI is absent or `forge new` cannot run, do this by hand instead: copy `templates/build/DECISIONS.md` and `templates/build/DESIGN.md` to `.forge/build/DECISIONS.md` and `.forge/build/DESIGN.md`, and record the same frame content in prose inside them. State plainly that this fallback path is unverified — no CLI derived it — and that `.forge/build/project.json` will not exist until the CLI is available. Never fabricate a JSON state file by hand to imitate one.

## State and evidence

Everything lives under `.forge/build/`, which stays git-ignored by default; docs show an opt-in `.gitignore` negation for teams that want to commit it. Nothing written in this phase is evidence for `forge ship` or `forge all audit` — build state is agent context only, never a gate input.

## Non-goals and scope

`forge new` never audits existing code, never performs a git changed-scope operation, and never edits application source; it only frames the work ahead. Once a feature exists, hand off to `/forge-feature <slug>` for its lifecycle.

## Loop prevention and decision rules

Building a feature → `forge feature <slug> check`. Reviewing an arbitrary diff → `forge all audit --scope changed`. `forge new` itself has no `check` or `done` sub-verb, so there is nothing to loop on here — its only job is to produce a frame worth building from.

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.
