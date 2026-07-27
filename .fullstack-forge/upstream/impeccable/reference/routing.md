# No-argument routing: the context-aware menu

Read this when the user invokes `$forge ui` with no argument. They are asking "what should I do?" Make the menu context-aware instead of static.

> **Not available in Fullstack Forge.** This step relies on upstream content Forge deliberately does not vendor (scripts/context-signals.mjs). Skip it and continue with the surrounding procedure; Forge's own workflow does not depend on it.

Reason over the signals; there is no score to obey:

- `setup.hasDesign` false while `setup.hasCode` true → `document` (capture the visual system).
- `critique.latest` is `null` → the project has never been critiqued; for a set-up project with a real surface, offering `$forge ui critique <surface>` is a strong default.
- `critique.latest` with a low `score` or non-zero `p0` / `p1` → `polish` (it reads that snapshot as its backlog), or re-run `critique` if the snapshot looks stale.
- `git.changedFiles` pointing at one surface → scope `audit` or `polish` to those files specifically, naming them.
- `devServer.running` true → `live` is available for in-browser iteration; if false, don't lead with `live`. **`live` and the bundled `detect.mjs` are web-only.** If `setup.platform` is `ios`, `android`, or `adaptive`, don't lead with either; the browser overlay and the HTML rule engine don't apply to native app code.
- Otherwise group by intent (build new / improve what's there / iterate visually), tailored to the current surface and `setup.platform`.

> **Not available in Fullstack Forge.** This step relies on upstream content Forge deliberately does not vendor (scripts/detect.mjs). Skip it and continue with the surrounding procedure; Forge's own workflow does not depend on it.

Keep it to 2-3 pointed picks with the exact command to type. The menu stays the fallback; the recommendation is the lede.
