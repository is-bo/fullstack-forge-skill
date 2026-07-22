# Ship a release

Run the independent release gate only after building, auditing, fixing, and verifying:

```bash
npx forge ship
```

Forge re-discovers the current project and revision. Saved Audit reports are diagnostics; Build
state satisfies no Ship gate. Project commands remain blocked until you review them and explicitly
allow execution:

```bash
npx forge ship --allow-run
```

Exit status `0` means the local registered gates passed. `1` means a gate failed. `2` means evidence
was blocked or insufficient. A local pass does not prove remote CI, registry publication,
deployment, provider configuration, or production health; collect those separately.

The terminal names the smallest visible actions. The authoritative local evidence remains in
`.forge/report.md` and `.forge/report.json`.
