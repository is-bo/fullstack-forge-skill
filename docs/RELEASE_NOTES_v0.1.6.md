# Fullstack Forge v0.1.6

Rendered-UI security milestone. Three defects were independently reproduced against v0.1.5 before
any remediation was written, and each fix is covered by regression tests that fail against the
previous implementation.

This release completes the rendered-UI security milestone only. It does not close the other deferred
specification areas — report-ledger redesign, changed-scope applicability semantics, discovery
evidence classes, normal-audit orchestration, and the static security analyzer are unchanged and
remain outstanding.

## Fixed

### Offline mode is enforced across the whole browser, not just the first URL

v0.1.5 validated the initial destination and then called `page.goto()` with no further checks. Once
a loopback page was open it could still reach the network freely: an HTTP redirect to a public host,
a remote script, stylesheet, font, or image, an `iframe`, a worker, or any `fetch`/XHR the page
chose to issue. Each of those performs DNS resolution and opens a connection, so the documented
offline contract — "no DNS resolution or network request was attempted" — was true only of the first
URL.

Rendered inspection now installs a request interceptor before navigating and evaluates every request
against a single network policy. Non-loopback HTTP and HTTPS requests are aborted before they are
sent, which prevents both the connection and the DNS lookup that would precede it. Redirects surface
as fresh requests for the new destination and are blocked the same way. Blocked destinations are
recorded as evidence with their URLs redacted, and any blocked request prevents a `COMPLETE`
capture, so a page that only rendered because its resources were withheld cannot yield a rendered
`PASS`.

Loopback classification moved into a shared `net-policy` module rather than being duplicated as
string comparisons. It covers `localhost`, `*.localhost`, the entire `127.0.0.0/8` range, `::1`,
IPv4-mapped and IPv4-compatible IPv6 loopback, and trailing-dot and case variants; numeric IPv4
forms are normalized by the URL parser before classification. Private, link-local, unique-local, and
cloud-metadata addresses are classified explicitly and are never treated as loopback.

Two boundaries are stated honestly rather than overclaimed. A browser driver that cannot intercept
requests is refused outright under `--offline` instead of falling back to the old initial-URL check.
WebSocket handshakes are not covered by HTTP request interception, so a loopback guard is installed
inside the page as an init script; transports outside interception and that guard — WebRTC and
browser-internal telemetry among them — are recorded as `NOT_VERIFIED` rather than claimed blocked.

### Incomplete rendered capture fails closed

v0.1.5 granted a rendered `PASS` whenever at least one screenshot existed and no console error was
seen, and exited `0` whenever no console error was seen at all. Two outcomes followed directly. One
viewport succeeding and two failing produced a `PASS` describing "1 viewport screenshot(s)" as
positive rendered-state evidence. Every viewport failing produced zero screenshots, zero findings,
status `OK`, and exit code `0` — a completely failed inspection reported as a clean run.

Every run now reports an explicit `capture_status`:

```text
COMPLETE  every required viewport captured and hashed, nothing blocked
PARTIAL   some evidence collected, but a required step failed or was blocked
BLOCKED   a policy boundary prevented execution
FAILED    execution was attempted but produced no usable capture
```

Only `COMPLETE` with zero console errors may produce the informational `FF-UI-RENDER-001` `PASS`.
`COMPLETE` with console errors produces the failing `FF-UI-CONSOLE-001`. Every other status produces
`FF-UI-CAPTURE-001` and leaves the rendered criteria `NOT_VERIFIED`. Each viewport carries its own
status, artifact, hash, and error, and a screenshot call that resolves without writing a readable
artifact is now a failure rather than counted evidence. Partial evidence is preserved rather than
discarded, the manifest and the CLI result always report the same status, and browser cleanup runs
on every launch-success path with close failures recorded instead of swallowed.

Exit codes follow one rule: `0` is reserved for a complete capture with nothing failing, `1` marks a
run with a failing finding or a runtime failure, and `2` marks a run whose evidence is merely
absent.

### All rendered evidence is redacted before it is written

v0.1.5 redacted query values in the source URL but wrote console text, page errors, and navigation
failures verbatim into `console.json`, into finding evidence, and into limitations. Those strings
are application-controlled and routinely carry bearer tokens, session cookies, API keys, full URLs
with credentials, and absolute paths naming the operator's account.

One shared redaction layer now processes every string before it is written, printed, or turned into
a finding. It removes URL userinfo, query values, and fragments; authorization, cookie, session, and
API-key assignments across `=`, `:`, and quoted-JSON syntaxes; JWT-shaped values and vendor-prefixed
keys; residual high-entropy credential runs; and home-directory paths on both Windows and POSIX.
Output is length-bounded and states whether it was redacted, truncated, or both, so a shortened
string is never presented as whole. Redaction is deliberately structural rather than a list of known
secrets. SHA-256 digests are preserved because they are evidence rather than credentials, and
ordinary diagnostics such as `net::ERR_CONNECTION_REFUSED` remain fully readable.

### A double browser close on the offline refusal path

Refusing a non-intercepting driver under `--offline` closed the browser explicitly and then closed
it again in the cleanup block. Found by the new regression tests and fixed; cleanup now runs exactly
once.

## Compatibility

`RenderedUiResult` gains `capture_status`, `viewports`, and `blocked_requests`; the rendered-UI
evidence manifest moves to `schema_version: 2` with the same additions. This is the tool's own
evidence manifest, not the audit report schema — report loading and migration for v0.1.3, v0.1.4,
and v0.1.5 are untouched. No public report schema migration is included in this release. Playwright
and browser binaries remain optional; the implementation is exercised in tests through controlled
fake browser objects.

## Verification

Local validation covers formatting, lint, type checking, the full test suite, coverage thresholds,
validation, platform synchronization, links, licenses, fixtures, workflow policy, release documents,
install documents, branding, secret scanning, deterministic packaging of all nine platform archives,
dist validation, smoke and offline installation, and `npm audit`. Rendered-state criteria stay
`NOT_VERIFIED` wherever no trusted browser driver is available, which is the expected outcome for
this repository's own CI. See `docs/RELEASE_VERIFICATION_v0.1.6.md` for the verification record and
its pending remote steps.
