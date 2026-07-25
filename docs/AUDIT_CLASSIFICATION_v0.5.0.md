# Audit classification — v0.5.0

This record closes or bounds the thirteen product-polish gaps captured before implementation in
`PRODUCT_GAP_REPORT_v0.5.0.md`. `FIXED` means implementation and local regression evidence exist; it
does not claim remote CI, publication, production behavior, or execution inside every vendor agent
host.

| Gap                                                             | Classification  | Implementation and test evidence                                                                    | Residual boundary                                                                                        |
| --------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| FF-PRODUCT-101 documented composite audit rejected              | FIXED           | bounded conjunction routing in `simple-cli.ts`; unit and compiled CLI coverage                      | Each conjunction side must resolve independently; intrinsic ambiguity remains an error.                  |
| FF-PRODUCT-102 Verify returned success with incomplete evidence | FIXED           | Verify exit mapping plus disappearance and risk-exclusion regressions                               | Exit 2 means blocked or incomplete, not a proven defect.                                                 |
| FF-PRODUCT-103 interrupted installation lost ownership          | FIXED           | ownership-first atomic install transaction; two interruption boundaries and unowned-file regression | A hostile same-user path-swap race remains a local trust-boundary risk.                                  |
| FF-PRODUCT-113 stale positive evidence was rebound              | FIXED           | revision comparison, finding/gate demotion, and stale-positive tests                                | A directly re-run producer is still required to restore a positive result.                               |
| FF-PRODUCT-104 Doctor omitted update availability               | FIXED           | strict stable-tag parser, fixed argument vector, offline/failure tests                              | The remote lookup is advisory and remains a warning when unavailable.                                    |
| FF-PRODUCT-105 install success hid first choices                | FIXED           | install renderer and CLI end-to-end assertions for Doctor, Build, Audit, and Help                   | Slash-command presentation remains host-specific.                                                        |
| FF-PRODUCT-106 no supported-agent recommendation                | FIXED           | finite marker/PATH hint detector, link refusal, no-evidence, and no-execution tests                 | Hints do not prove an application is installed or running.                                               |
| FF-PRODUCT-107 product requirements absent from traceability    | FIXED           | FF-PRODUCT-01 through FF-PRODUCT-06 and generated 87-requirement matrix                             | External host execution remains explicitly limited.                                                      |
| FF-PRODUCT-108 demo stopped before Ship                         | FIXED           | quickstart end-to-end test now asserts fail-closed Ship and its next action                         | Remote/provider evidence is intentionally unavailable in the local demo.                                 |
| FF-PRODUCT-109 previous-release upgrade was assumed             | FIXED           | prior-manifest interrupted-update regression and clean v0.4.0-to-candidate lifecycle                | A future release must repeat the clean upgrade against its own predecessor.                              |
| FF-PRODUCT-110 slash typos are partly host-owned                | PARTIALLY_FIXED | CLI typo suggestions and documented `/froge`/`/forget` boundary                                     | A misspelled skill name rejected by a host never reaches Forge; live host UI behavior is `NOT_VERIFIED`. |
| FF-PRODUCT-111 Markdown tables contained raw pipes              | FIXED           | corrected public tables plus format and link validation                                             | None identified.                                                                                         |
| FF-PRODUCT-112 most host support was structural only            | NOT_VERIFIED    | six generated roots, selector installs, archives, and path documentation validated                  | Live Codex, Claude, Cursor, Gemini, Antigravity, Windsurf, and Copilot UIs were not all launched.        |

## Compatibility result

- All 42 Audit module slugs, expert modes, tools, installer selectors, and Build lifecycle commands
  remain available.
- Report schema 2, Build schema 2, finding identifiers, evidence-envelope contracts, ownership
  manifest schema 1, migration behavior, JSON output, and Ship independence are unchanged.
- The composite audit route uses the existing module-decision and orchestration path. It does not
  add an analyzer, producer, safe-fix authority, command-execution authority, or alternate `PASS`.
- `NOT_VERIFIED` now makes Verify incomplete. This is a deliberate correction to the documented
  exit-code contract rather than a data-format break.

## Security result

- Install writes remain root-contained and link-refusing. Complete conflict preflight happens before
  mutation, new ownership is atomically prepared before file creation, each replacement is atomic,
  and a retry accepts only the recorded prior or bundled current hash.
- Agent detection reads finite names only, ignores marker links, never executes a discovered path,
  and cannot block the compatible `all` install.
- Doctor invokes Git with an argument vector and a fixed upstream URL. Only canonical stable release
  refs are accepted; remote diagnostics are redacted and bounded.
- Stale findings, scope evidence, and typed gate records are not represented as current positive
  evidence. Missing or unreproduced evidence remains `NOT_VERIFIED`.
- Build state still satisfies zero Ship gates, and project commands still require explicit
  `--allow-run`.

## External limitations

Actual host UI discovery, provider settings, deployment state, production behavior, browser and
assistive-technology behavior, and remote publication require their own environments. Generated
format compatibility is direct evidence; it is not reported as proof of live host execution.
