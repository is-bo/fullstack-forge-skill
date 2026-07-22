# Ten-minute Fullstack Forge demo

This tiny project contains one safe intentional defect: a JSX link opens a new tab without isolating
the original page. The normal onboarding journey finds it, previews a bounded fix, applies it, and
verifies the result without network access.

From this directory, using a repository checkout or installed v0.4 package:

```bash
npx forge audit frontend
npx forge fix frontend
npx forge fix frontend --safe
npx forge verify frontend
npx forge ship
```

Expected milestones:

1. Audit reports `FF-FRONTEND-BLANK-001` and writes `.forge/report.md`/`.forge/report.json`.
2. The first fix command says no files changed and shows the intended `src/App.tsx` edit.
3. The `--safe` command adds `rel="noopener noreferrer"` only to the proven link.
4. Verify no longer reports that occurrence as failing.
5. Ship may remain blocked because a demo cannot provide remote CI, deployment, production, or
   provider evidence. That honest result is part of the demo.

Reset `src/App.tsx` from version control before repeating the demo.
