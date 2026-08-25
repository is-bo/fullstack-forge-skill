# Composition evaluation — upstream-powered Fullstack Forge

This records what was measured when Forge moved from carrying its own copy of every specialist
practice to composing vendored upstream expertise, and — just as importantly — what was **not**
measured.

Reproduce with:

```bash
npm run build
npm run eval:composition
```

Raw machine-readable results: `npm run eval:composition -- --json`.

## What this evaluation measures

The base corpus in `composition-corpus.json` holds 27 scenarios: the 25 original required scenarios
plus two earlier explicit-request cases. `composition-saturation-corpus.json` adds 13 adversarial
cases—one for every module tier whose declarations can exceed its budget. Each saturated case
activates every provider dimension and task flag, requests one exact source, and proves that source
survives while the tier stays bounded and reports its drops.

For each case the harness resolves the real composition registry through the real composition engine
and reports:

- which upstream sources activate, and which are suppressed;
- the instruction bytes a Forge-only baseline would load (the module contract plus the module
  playbook — the same content the starting `main` loaded);
- the **eager** cost: baseline plus the one primary upstream workflow, which is what a task reads on
  entering the module;
- the **available** cost: baseline plus every selected source, including overlays and supplemental
  references that are only read on demand.

Both cost figures are reported. Publishing only the smaller one would flatter the design.

## What this evaluation does not measure

It does **not** measure agent task outcomes. Task completion, correctness, regressions, false
positives, false negatives, changed-line counts, runtime, or test quality would each require running
real agent tasks against real repositories with established ground truth, on both the starting
`main` and this build. That was not done, so no such number is reported and no claim of improved
quality is made anywhere in this release.

Nothing here demonstrates causation or superiority. It demonstrates that composition behaves as
specified and shows what it costs.

## Results

All 40 cases pass their activation, suppression, and budget expectations. Across the corpus, 134
provider sources were correctly suppressed, and 2 cases (a non-PostgreSQL database and multi-tenant
object access) correctly loaded **no** provider content at all. All 13 saturated tiers selected the
exact requested source, stayed at their declared limit, and reported a context-budget suppression.

| Metric                             | Result |
| ---------------------------------- | ------ |
| Cases                              | 40     |
| Activation and suppression correct | 40     |
| Sources correctly suppressed       | 134    |
| Cases loading no provider content  | 2      |
| Median eager context increase      | +94%   |
| Maximum eager context increase     | +433%  |
| Median available context increase  | +257%  |
| Maximum available context increase | +933%  |

These figures are asserted against the live harness by `scripts/tests/composition-corpus.test.mjs`,
so the table cannot drift away from what `npm run eval:composition` actually reports.

Provider gating held in every direction that was tested: React guidance stayed out of a Vue
repository; React Native guidance required React Native rather than merely React; Vercel,
Cloudflare, Google Cloud, and Sentry material each required its own proven hosting or tooling;
Supabase stayed suppressed on plain PostgreSQL while provider-neutral PostgreSQL guidance still
loaded; and Stripe and PayPal each activated only for their own provider.

## The context-budget target was not met

The stated target was no more than a 15% increase in loaded instruction tokens for a normal focused
task. **This build does not meet that target**, by a wide margin: the median focused task loads
roughly 2.0× the instruction text of the Forge-only baseline before any reference is opened, and
about 3.6× once every reference the manifest makes available is counted.

This is inherent to the architecture, not an implementation defect that was overlooked. A module
whose engine is an upstream workflow has to read that workflow; upstream specialist skills are
typically 10–40 KB, while a Forge module playbook is 1–6 KB. "Upstream-powered" and "within 15% of
Forge-only" are in direct tension, and the source set and module-by-module design were both fixed
requirements.

What was done to keep the cost as low as honesty allows:

- Provider content is suppressed unless evidence activates it—134 suppressions across 40 cases.
- Each module admits at most one primary workflow, and normally at most two overlays; every drop is
  reported rather than hidden.
- Only overlays and supplemental references are progressive; the eager figure above already excludes
  them.
- Forge-authored duplication went **down**, not up: boilerplate measured 23.04% primary / 33.47%
  masked / 15.84% shingle-8, against the 23.42% / 34.21% / 16.26% baseline on the starting `main`.
  The shared composition guidance lives in one place rather than being repeated across 42 modules.
- No full provider repository is ever loaded into context.

No metric here was gamed by reformatting. The measurement is byte-based over the same files a task
would read, and the harness is committed alongside the corpus so the numbers can be re-derived.

If the 15% ceiling is treated as binding, the architecture would have to change: either upstream
primaries become progressive (read only after the module proves it needs them) or Forge summarises
upstream workflows instead of vendoring them, which reintroduces exactly the duplicated, drifting,
Forge-authored specialist guidance this change removed. That trade-off is a product decision and is
flagged here rather than resolved unilaterally.

## Non-regression

The behaviours that must not regress are covered by the existing suite rather than by this corpus,
and all of it passes: upload analysis, authorization precision, tenancy, transaction analysis, SQL
precision, cache analysis, finding supersession, audit and Ship application-finding parity,
canonical installation, and the evidence statuses. See the full test run and coverage in the release
verification record.

## Corpus coverage

| #   | Case                                     | Focus                                          |
| --- | ---------------------------------------- | ---------------------------------------------- |
| 01  | Ambiguous feature requirements           | interview → refine → spec sequence             |
| 02  | API design                               | upstream-powered API workflow                  |
| 03  | Code simplification                      | incremental implementation and simplification  |
| 04  | Bug investigation                        | debugging without Sentry                       |
| 05  | TDD implementation                       | test-driven workflow and applicability         |
| 06  | React performance                        | React overlay activation                       |
| 07  | Non-React frontend                       | React overlay suppression                      |
| 08  | UI redesign in an existing design system | Impeccable with design-system preservation     |
| 09  | Blank-slate UI                           | Impeccable without an incumbent system         |
| 10  | Accessibility audit                      | checklist plus WCAG and screen-reader patterns |
| 11  | PostgreSQL optimisation                  | PostgreSQL practice without Supabase           |
| 12  | Non-PostgreSQL database                  | full provider suppression                      |
| 13  | Supabase auth and RLS                    | Supabase activation                            |
| 14  | Generic auth                             | Supabase and Firebase suppression              |
| 15  | Vercel optimisation                      | Vercel activation, other hosts suppressed      |
| 16  | Non-Vercel deployment                    | all host overlays suppressed                   |
| 17  | Cloudflare Worker                        | Cloudflare activation                          |
| 18  | Google Cloud service                     | Well-Architected activation                    |
| 19  | Sentry issue investigation               | Sentry activation                              |
| 20  | Generic observability                    | Sentry not required                            |
| 21  | Stripe payment integration               | Stripe only                                    |
| 22  | Non-Stripe payment flow                  | both providers suppressed                      |
| 23  | Secure upload flow                       | Forge-native uploads authority                 |
| 24  | Multi-tenant object access               | Forge-native tenancy authority                 |
| 25  | Release-readiness review                 | Ship gate with upstream procedure              |
| 26  | Explicit GKE under a saturated budget    | explicit request outranks competing evidence   |
| 27  | Explicit Sentry Next.js under saturation | explicit stack request survives the budget     |
| 28  | Saturated i18n                           | supplemental budget and exact source request   |
| 29  | Saturated frontend                       | framework overlay budget                       |
| 30  | Saturated jobs                           | provider overlay budget                        |
| 31  | Saturated security                       | supplemental security budget                   |
| 32  | Saturated uploads                        | storage-provider overlay budget                |
| 33  | Saturated storage                        | object-storage overlay budget                  |
| 34  | Saturated performance                    | performance-provider overlay budget            |
| 35  | Saturated observability                  | thirteen-way observability overlay contention  |
| 36  | Saturated reliability                    | reliability-provider overlay budget            |
| 37  | Saturated deployment                     | deployment-provider overlay budget             |
| 38  | Saturated infrastructure                 | six-way infrastructure overlay contention      |
| 39  | Saturated AI                             | AI-provider and telemetry overlay budget       |
| 40  | Saturated realtime                       | realtime-provider overlay budget               |
