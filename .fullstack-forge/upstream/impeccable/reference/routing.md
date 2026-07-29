<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

# No-argument routing: the context-aware menu

Read this when the user invokes `$forge ui` with no argument. They are asking "what should I do?" Make the menu context-aware instead of static.

Use Forge discovery and current repository evidence. If PRODUCT.md is absent, lead the menu with `$forge ui init` as the top recommendation and still show the rest; do not silently run it. Otherwise lead with the **2-3 highest-value next commands**, each with a one-line evidence-backed reason, followed by the full menu in PLAYBOOK.md grouped by category. **Never auto-run a command; the recommendation is a suggestion the user confirms.**

Reason over the signals; there is no score to obey:

- DESIGN.md absent while interface code exists → `document` (capture the incumbent visual system).
- No compatible critique exists under `.fullstack-forge/ui/critique/` → offer `$forge ui critique <surface>` for a real surface.
- A compatible critique has unresolved P0/P1 evidence → `polish`, or re-run `critique` when its evidence is stale.
- Changed files point at one surface → scope `audit` or `polish` to those files, naming them.
- Otherwise group by intent (build new / improve what exists / inspect visually), tailored to the current surface and confirmed platform.

Use applicable Forge accessibility, frontend, performance, UI, and UX findings as supporting signals. Many verified quality or contrast findings suggest `audit` or `polish`; a specific pattern may suggest `quieter`, `typeset`, or `colorize`. Keep subjective advice separate from deterministic findings, and never block the menu when an evidence source is unavailable.

Keep it to 2-3 pointed picks with the exact command to type. The menu stays the fallback; the recommendation is the lede.
