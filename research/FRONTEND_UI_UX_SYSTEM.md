# Agent-first frontend, UI, and UX system

Research and architecture decision: 2026-07-26. Repository and fetched content were treated as
untrusted data. Upstream repositories were shallow-cloned into an external temporary directory;
their scripts were not run. Fullstack Forge uses original prose, code, examples, and data.

## Repository map before the change

| Surface                                                  | Previous role                              | Constraint retained                                                           |
| -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/fullstack-forge/SKILL.md`                           | Agent-first production workflow            | Remains the top-level authority and evidence contract                         |
| `commands/forge/SKILL.md`                                | Plain-language and explicit command router | Remains the single user-facing router                                         |
| `forge-frontend`                                         | Generated frontend audit module            | Becomes the concise experience orchestrator without creating a second catalog |
| `forge-ui` / `forge-ux`                                  | Generated specialist audits                | Remain separate visual and journey owners                                     |
| Accessibility, i18n, SEO, performance, offline, security | Specialist modules                         | Keep canonical ownership; frontend guidance composes them                     |
| `config/modules.json`, criteria, procedures              | Generated module source                    | Remain canonical generation inputs                                            |
| `cli/src/build-applicability.ts`                         | Build discipline selection                 | Receives deterministic natural-language interface routing                     |
| Finding schema and reports                               | Official evidence interchange              | Gains rendered-review provenance without weakening statuses                   |
| Six platform roots                                       | Generated distribution copies              | Continue to be produced only by `npm run generate`                            |

The prior system already had strong evidence semantics, safe-fix boundaries, installation ownership,
and three relevant modules. It lacked creation-oriented frontend routing, focused references,
product and visual framing, mobile/data/form specialization, scoped UI/UX command aliases,
structured rendered-review findings, and scenario-level proof that irrelevant guidance stayed
unloaded.

## Upstream comparison

| Source                           | Strongest contribution                                                             | Weakness for Forge                                                                     | Distinctive idea                                            | Decision                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Anthropic frontend-design        | Product-grounded visual direction, meaningful copy, and rendered self-critique     | Novelty can outrun preservation, accessibility, and operational evidence               | One restrained signature choice rather than generic styling | Adopt product rationale and critique; subordinate novelty to the task                  |
| Vercel web guidelines            | Very compact, broad, actionable interface review                                   | Its skill fetches an unpinned remote `main`, making behavior non-reproducible          | Terse line-addressed findings                               | Adopt concise actionable review; reject runtime instruction fetching                   |
| Vercel React best practices      | Impact-ranked waterfall, bundle, boundary, and rerender guidance                   | Version-specific advice and low-impact micro-optimization can be over-applied          | Structural performance priority                             | Adopt measured high-impact structure; keep framework/version detection mandatory       |
| Vercel composition patterns      | Clear alternatives to boolean-prop growth and coupled implementations              | Mechanical composition can create premature abstraction                                | State/actions/metadata provider contract                    | Adopt explicit variants and behavioral ownership proportionately                       |
| Microsoft frontend design review | Existing-system inspection and structured creation/review output                   | Assumes Figma/design-team workflows and uses weaker or ambiguous accessibility grading | Three review lenses: friction, craft, trust                 | Adopt design-system inspection and prioritized findings; retain WCAG 2.2 AA            |
| UI UX Pro Max                    | Broad searchable taxonomy across product, style, UX, charts, motion, and stacks    | Large datasets and blanket thresholds can create generic output and excess context     | Domain search before stack detail                           | Adopt the domain taxonomy for progressive routing; copy no dataset or generated system |
| AccessLint audit                 | Live DOM preference, deduplication by cause, and before/after violation sets       | MCP/browser-engine-specific and incomplete for manual WCAG judgment                    | Explicit residual manual gaps                               | Adopt rendered evidence and residual limitations; keep tool claims bounded             |
| Expo skills                      | Platform/version detection and focused mobile progressive disclosure               | SDK-specific recommendations age quickly and can be dependency-heavy                   | Universal versus platform-specific decision                 | Activate only for proven React Native/Expo and record untested platforms               |
| shadcn skill                     | Inspect project context, reuse owned primitives, and consult actual component docs | Library-specific guidance is wrong without `components.json` or equivalent evidence    | Treat copied component source as project-owned              | Adopt inspect/reuse/preview concepts; never recommend shadcn globally                  |

The synthesis is intentionally not a compilation. Forge contributes the cross-cutting ownership
model, proportional workflow, affirmative evidence statuses, safe-change policy, deterministic
routing, generated multi-agent packaging, and report contract.

## Gap analysis and decisions

| Gap                                                                                  | Decision                                                                                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary interface requests selected only coarse modules                             | Add a pure deterministic router that returns modules, progressive references, workflow, scale, and reasons                      |
| Main skills risked becoming enormous                                                 | Keep `forge-frontend` between 150 and 300 lines and move concern detail into 14 focused references                              |
| Accessibility/performance rules could be duplicated                                  | Keep canonical specialist ownership and use integration references only                                                         |
| UI creation lacked product and visual direction                                      | Add optional design brief/system templates and require short decisions only for substantial work                                |
| Visual validation was described but not a producer                                   | Add `agent-rendered-review` plus structured rendered evidence                                                                   |
| Mobile, dashboards, forms, motion, and React guidance were not selectively available | Add references with explicit load and skip conditions                                                                           |
| Scoped `review`, `improve`, and `build` forms were absent                            | Normalize review to audit, improve to fix preview, and make build an honest agent-workflow selection                            |
| Guidance could drift or duplicate                                                    | Validate reference ownership, required disclosure headings, exact duplicate long bullets, orchestrator size, and scenario count |

## Final architecture

```text
fullstack-forge / forge router
└── forge-frontend (experience orchestrator)
    ├── forge-ui (visual direction and rendered consistency)
    ├── forge-ux (task flows, states, feedback, and recovery)
    ├── forge-accessibility (semantic and WCAG 2.2 AA owner)
    ├── conditional owners: i18n, SEO, performance, offline, security
    └── references/frontend/* (14 progressively loaded concerns)
```

Natural-language selection is implemented in `cli/src/frontend-routing.ts` and composed into Build
applicability. The generated skills use `config/frontend-system.json` for workflow, command, and
reference disclosure. The two sources have different responsibilities: runtime request selection
versus generated agent instructions. `scripts/check-frontend-system.mjs` validates their public
reference surface and prevents a competing reference tree.

The operational sequence is UNDERSTAND, INSPECT, SELECT, DEFINE, IMPLEMENT, RENDER, VALIDATE,
REFINE, REPORT. Small work records the same decisions inline. High-consequence interfaces add
security and stronger failure/recovery evidence. Source review never substitutes for rendered
behavior.

## Scenario validation design

The executable scenario table is in `cli/tests/frontend-routing.test.ts`; the expectations below
summarize its intended behavior.

| Scenario                        | Main selection                                       | Focused references                              | Explicit equivalent     | Excluded context                             | Expected evidence and limitation                                                                            |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------- | ----------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Healthcare SaaS dashboard       | frontend, UI, accessibility, security                | product, visual/system, dashboard, responsive   | `$forge frontend build` | native mobile                                | High-consequence states and role-safe rendered evidence; clinical users remain unresearched unless observed |
| Startup landing page            | frontend, UI, accessibility, SEO                     | visual, system, responsive                      | `$forge ui build`       | native mobile, dense dashboards              | Narrow/wide rendered HTML and metadata; ranking remains unverified                                          |
| Inventory/POS desktop           | UI, accessibility                                    | product, visual, dashboard, responsive          | `$forge ui build`       | React Native                                 | Dense realistic data and keyboard operation; physical POS hardware may remain unverified                    |
| Mobile-first booking flow       | frontend, UX, accessibility                          | product, forms, responsive                      | `$forge frontend build` | React Native unless proven                   | Input preservation and adverse states; real device/network evidence may be absent                           |
| Dense admin table               | frontend, accessibility                              | forms, dashboard, responsive, review            | `$forge frontend audit` | native mobile                                | Selection/bulk-action and overflow evidence; large-data performance needs measurement                       |
| Inconsistent React app          | frontend, UI, accessibility                          | component, React, system, review, anti-patterns | `$forge ui review`      | native mobile, charts                        | Repeated-component before/after comparison; broad redesign requires approval                                |
| Slow Next.js app                | frontend, performance, accessibility                 | React, frontend performance, review             | `$forge frontend audit` | native mobile, charts                        | Production-build baseline and repeat measurement; lab data is not field data                                |
| React Native/Expo app           | frontend, UI/UX, accessibility, offline, performance | mobile, motion, system, performance             | `$forge frontend build` | web SEO, dashboards by default               | Platform/version and network-state evidence; untested OS/device is named                                    |
| Arabic RTL and French UI        | UI, i18n, accessibility                              | responsive, system, accessibility integration   | `$forge ui review`      | native mobile, dashboards                    | RTL, expansion, formats, and keyboard evidence; translation quality needs human review                      |
| Form accessibility review       | UX, accessibility                                    | forms, accessibility integration, review        | `$forge ux review`      | mobile and charts                            | Automated plus keyboard/manual gaps; unrun assistive technology stays unverified                            |
| One-component style change      | frontend, UI, accessibility                          | component/system only as implicated             | `$forge ui fix`         | product redesign, mobile, dashboards, motion | Focused component states and tests; no design brief bureaucracy                                             |
| Existing UI preserving behavior | UI, accessibility, conditional UX/frontend           | review, system, anti-patterns                   | `$forge ui review`      | unrelated specialist references              | Before/after behavior and visual evidence; unrelated screens remain out of scope                            |

Each scenario asserts activation, required modules and references, explicitly excluded references,
workflow, scale, and nonempty selection reasons. Separate tests cover backend-only non-activation
and scoped command normalization.

## Migration summary

- No module slug, report status, installer path, or platform target was removed.
- Existing `frontend`, `ui`, and `ux` commands keep audit/fix/verify/report compatibility.
- `review` and `improve` are aliases with existing evidence and authorization semantics.
- `build` is additive and reports that no implementation or render ran; it does not mutate Audit or
  Build state by implication.
- Existing finding producers remain valid. The rendered producer and evidence type are additive.
- Canonical changes are authored only under `src/fullstack-forge`, `config`, CLI, docs, tests, and
  research; platform copies are regenerated mechanically.

## Validation report

Local validation ran on Microsoft Windows 10 Professional 10.0.19045 (64-bit), Node.js 24.14.1, and
npm 11.11.0. The worktree evidence below is not a substitute for hosted or published-release
evidence.

| Check                                          | Observed result                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS; 91 packages installed from the lockfile                                                                            |
| `npm run generate`                             | PASS; 42 command skills, 3 Build skills, 42/42 guidance briefs, and 125 files synchronized to each of 6 roots            |
| Formatting, ESLint, and TypeScript             | PASS                                                                                                                     |
| `npm test` / aggregate test run                | PASS; 756 tests, 755 passed, 0 failed, 1 intentional skip                                                                |
| `npm run test:coverage`                        | PASS; 94.58% lines, 82.85% branches, and 94.33% functions                                                                |
| `npm run validate`                             | PASS; 46 canonical skills, 6 generated roots, schemas, and interface metadata                                            |
| `npm run check:frontend-system`                | PASS; 14 references, 3 templates, 3 owners, and 12 scenarios                                                             |
| `npm run check`                                | PASS through archives, licensing, fixtures, workflows, release/install docs, traceability, branding, and secret scanning |
| `npm run package:platforms`                    | PASS; 9 archives and 2 metadata files, with 2,173 validated archive entries                                              |
| `npm run smoke:install`                        | PASS; 46 installed skills, automatic activation, no symlinks, and owned records removed                                  |
| `npm run smoke:upgrade`                        | PASS; fixture upgrade, doctor readiness, automatic activation, no symlinks, and clean uninstall                          |
| `npm run offline:install`                      | PASS; cache-only npm install, 46 skills in each of 6 roots, no symlinks, and clean uninstall                             |
| `npm audit --ignore-scripts`                   | PASS; 0 known vulnerabilities                                                                                            |

The first coverage run exposed an untested malformed rendered-evidence path in `finding.js` (91.55%
lines against its 92% floor). A focused negative test now covers malformed records, capture
metadata, input methods, and viewport dimensions. The exact full coverage command then passed with
`finding.js` at 95.95% line coverage.

Hosted Windows, Ubuntu, and macOS CI, dependency review, CodeQL, exact-clean-main Ship, public-tag
installation, release asset download verification, and GitHub release publication remain
`NOT_VERIFIED` until directly observed in the later release stages.
