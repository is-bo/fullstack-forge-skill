# Audit classification — v0.1.6

Every reported defect was reproduced against the untouched `cc7e9a1` baseline before any fix was
written. Classification uses `CONFIRMED`, `PARTIALLY_CONFIRMED`, `NOT_REPRODUCED`, `INVALID`, and
`NOT_VERIFIED`.

This release is scoped to the rendered-UI security milestone. It does not claim coverage of the
other open specification areas, which are listed unchanged at the end of this document.

## Reported defects

| Defect                                       | Classification | Reproduction against `cc7e9a1`                                                                                                                                                                                                                                                                                                                     | Resolution                                                                                                                                                                                                                                                  |
| -------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline mode checked only the initial URL    | CONFIRMED      | `cli/src/rendered-ui.ts:108` classified `parsed.hostname` once, then `page.goto()` ran at line 206 with no interception installed anywhere in the file. A loopback page could redirect to a public host or load remote scripts, styles, fonts, images, frames, workers, `fetch`, and XHR, each performing DNS resolution and opening a connection. | New `cli/src/net-policy.ts`; `page.route("**/*")` installed before navigation under `--offline`; non-loopback HTTP/HTTPS aborted before dispatch; redirects blocked as fresh requests; blocked destinations recorded redacted and prevent `COMPLETE`.       |
| Weak loopback classification                 | CONFIRMED      | `isLoopbackHost` matched `127.0.0.1` exactly rather than `127.0.0.0/8`, and had no handling for IPv4-mapped IPv6, expanded `::1`, or trailing-dot forms.                                                                                                                                                                                           | Classification centralized in `net-policy.ts` covering `localhost`, `*.localhost`, `127.0.0.0/8`, `::1`, IPv4-mapped/compatible IPv6, and trailing-dot and case variants; private, unique-local, link-local, and metadata ranges classified apart.          |
| Incomplete rendered capture reported success | CONFIRMED      | The PASS branch was `else if (screenshots.length > 0)` at line 288, so one viewport of three produced a rendered PASS. The exit code at line 328 was `errors.length > 0 ? 1 : 0`, so every viewport failing produced zero screenshots, zero findings, `status: "OK"`, and exit code `0`.                                                           | Explicit `capture_status` (`COMPLETE`, `PARTIAL`, `BLOCKED`, `FAILED`) plus per-viewport records; only `COMPLETE` with zero console errors may produce the informational PASS; a screenshot without a readable artifact is a failure; exit codes realigned. |
| Rendered evidence written unredacted         | CONFIRMED      | `message.text().slice(0, 500)` at line 190, `String(error.message).slice(0, 500)` at line 193, and the viewport failure message at line 211 reached `console.json`, finding evidence, and limitations verbatim. Only the source URL's query values were redacted.                                                                                  | New `cli/src/redaction.ts` applied to every evidence string before it is written, printed, or turned into a finding; structural rules for userinfo, query values, fragments, credential assignments, JWTs, vendor keys, high-entropy runs, and home paths.  |

## Additional defects discovered during this pass

| Defect                                               | Classification | Evidence                                                                                                                                                | Resolution                                                                                               |
| ---------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Double `browser.close()` on the offline refusal path | CONFIRMED      | Refusing a driver that cannot intercept closed the browser explicitly and then again in the `finally` block. Surfaced by the new close-count assertion. | The refusal returns from inside the `try` block and lets the single cleanup path close the browser once. |
| Substring host matching in new test assertions       | CONFIRMED      | CodeQL `js/incomplete-url-substring-sanitization` (high) flagged `url.includes("evil.example.com")`; an arbitrary host may appear before or after it.   | Assertions compare parsed `URL` hostnames or exact URLs instead of substrings.                           |

## Verified non-regressions

All 233 pre-existing tests pass unmodified. The v0.1.5 trust boundaries were re-checked and remain
in force: audited-project browser drivers are not imported without `--allow-run`; real-path
containment still rejects symlinked and redirected packages; `--dry-run` resolves, imports, and
launches nothing; `--offline` still refuses audited-project driver resolution; URL credentials are
still rejected before any path is derived; evidence remains isolated per revision, run, and route;
query strings and fragments still cannot escape the evidence directory. Report loading and migration
for v0.1.3, v0.1.4, and v0.1.5 are untouched, and historical tags remain unchanged.

## Explicitly not addressed in this release

These are open product gaps carried forward unchanged from v0.1.5, not defects introduced here. They
are recorded so the release does not imply coverage it lacks.

| Area                                                               | Status              | Reason                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline enforcement for project commands and ship gates            | NOT_VERIFIED        | `run-project-command` and `ship` still do not consume the offline flag; threading it through requires command classification beyond this milestone.            |
| Generic name-based security proof outside the SSRF destination map | NOT_VERIFIED        | Remaining name-derived protection grants are static-analyzer work outside the rendered-UI scope.                                                               |
| Destination-map immutability and address awareness                 | NOT_VERIFIED        | The map proof still accepts a mutable `const` object and does not classify private or metadata literals.                                                       |
| Changed-scope exclusions labelled `NOT_APPLICABLE`                 | NOT_VERIFIED        | Distinguishing "capability absent" from "capability not selected" requires a new machine-readable applicability structure across schema, renderers, and gates. |
| CLI audit orchestration of approved checks and rendered evidence   | NOT_VERIFIED        | Integrating runtime evidence into normal audit commands is a feature addition beyond this corrective patch.                                                    |
| Full `planned_checks` / `runtime_evidence` report ledger           | PARTIALLY_CONFIRMED | The `environment` ledger landed in v0.1.5; the planned-check and runtime-evidence ledgers did not.                                                             |
| Report-mode `--output` / `--json` contract                         | NOT_VERIFIED        | Report mode still renders to stdout only; the output-directory contract is unimplemented.                                                                      |
| Discovery evidence classes and activation weights                  | NOT_VERIFIED        | Detection still lacks per-signal evidence classes, so documentation-only and test-only signals are not yet weighted apart.                                     |
| Full specification traceability matrix                             | NOT_VERIFIED        | Not produced in this release; the milestone was scoped to the three rendered-UI areas.                                                                         |
