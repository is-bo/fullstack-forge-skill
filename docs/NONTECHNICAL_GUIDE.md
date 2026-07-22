# Fullstack Forge without the jargon

Forge asks two separate questions:

1. Did we build the requested behavior carefully?
2. Do we have current evidence that this application is safe to release?

Those are intentionally separate. Writing code, making a plan, or seeing no obvious error is not
proof that the product works.

The result words mean:

| Result           | Plain meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------------- |
| `PASS`           | A named check produced current positive evidence.                               |
| `FAIL`           | Reproducible evidence shows a defect.                                           |
| `WARNING`        | A meaningful risk exists, but Forge did not prove a defect.                     |
| `NOT_APPLICABLE` | Discovery shows this concern is outside the selected product or scope.          |
| `NOT_VERIFIED`   | The required proof was unavailable or unsupported.                              |
| `BLOCKED`        | A tool, permission, environment, approval, or required input stopped the check. |

Start with four commands:

```bash
npx forge build "describe what you want"
npx forge audit
npx forge fix
npx forge ship
```

`forge fix` previews changes. Add `--safe` only after reviewing that preview. Use `forge status` to
see unfinished work, the latest evidence, and the next command.

Technical terms and complete ledgers stay available in the detailed Markdown and JSON reports, but
you do not need to learn them before starting.
