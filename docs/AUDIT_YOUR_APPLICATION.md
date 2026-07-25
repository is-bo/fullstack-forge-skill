# Audit your application

Run the most useful safe default:

```bash
npx forge audit
```

Forge uses changed scope only when Git provides a reliable base revision. Otherwise it says that it
is auditing the full applicable project. To choose explicitly:

```bash
npx forge audit all
npx forge audit security
npx forge audit "the login system"
npx forge audit "uploads and file storage"
```

Natural-language areas map to existing specialist modules only when the mapping is clear. An
explicit conjunction such as `uploads and file storage` runs both named disciplines and reports that
finite mapping. An intrinsically ambiguous compact phrase lists the small set of choices and does
not silently run a different audit.

The concise output separates confirmed failures, warnings, blocked checks, and behavior that was not
verified. A result can be incomplete even when no defect was proven. Read the full evidence in
`.forge/report.md`, request terminal detail with `--details`, or consume `.forge/report.json`/
`--json` in automation.

Audits are read-only. Project-defined commands run only with `--allow-run` after you inspect their
definitions. Runtime UI inspection also requires a reachable URL and an available supported browser
driver; otherwise those criteria remain blocked or not verified.
