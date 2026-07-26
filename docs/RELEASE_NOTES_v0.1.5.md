# Fullstack Forge v0.1.5

Trust-boundary and honest-evidence patch. Four defects were independently reproduced against v0.1.4
before any remediation was written, and each fix is covered by a regression test that fails against
the previous implementation.

## Fixed

### `--offline` is now enforced, not merely parsed

`--offline` was accepted, documented, and stored, but no code path ever read it: audits behaved
identically with and without the flag. The flag now carries a defined contract. Under `--offline`
Fullstack Forge refuses HTTP and HTTPS requests to any non-loopback destination _before_ DNS
resolution is attempted, refuses to resolve a browser driver from the audited project (because
resolution can trigger installation or a registry lookup), and reports network-dependent checks as
`BLOCKED` with the criteria they would have covered left `NOT_VERIFIED`. It never reports `PASS` for
work it did not do. Offline state is recorded in the report environment ledger and in every rendered
evidence manifest. Static analysis, local report generation, local verification, installation from
bundled assets, and loopback UI inspection all remain fully available offline.

### Audited-project code is no longer executed without authorization

Rendered-UI inspection resolved Playwright from the audited project and dynamically imported it.
Importing a package executes its top-level JavaScript, so a hostile repository shipping a fake
`playwright` package could run arbitrary code inside the auditor's process. Two paths made this
worse than documented: the import happened for loopback URLs with no `--allow-run` at all, and it
happened _before_ the `--dry-run` check, so even a planning-only run executed the audited project's
code.

Browser drivers are now resolved from the Fullstack Forge package root first. The audited project's
copy is used only under explicit `--allow-run`, only after the resolved real path is proven to lie
inside the audited repository — which defeats symlink, path-escape, and module-redirection tricks —
and never under `--offline`. `--dry-run` resolves, imports, and launches nothing. The resolved
package, version, real path, trust domain, and trusted flag are recorded in evidence.

### SSRF protection requires structural proof, not a reassuring name

The analyzer granted `trusted-origin` and `network-constrained` protection whenever a callee name
matched `mapDestination`, `trustedDestination`, `resolveAllowedDestination`, or similar, and treated
any map whose text mentioned `allowed`/`trusted`/`destinations`/`routes` — or was simply uppercase —
as a server-owned allowlist. A one-line no-op named `mapDestination` therefore suppressed a real
SSRF finding, as did `const ALLOWED_DESTINATIONS = req.body`.

No protection is granted from an identifier's name any more. Destination proof now requires a
`const` declaration initialized with an object literal whose every value is a fixed absolute http(s)
URL literal and which never received request-controlled data, or a dominating guard bound to the
same tainted value that reaches the sink. Redirect control remains required. Anything the bounded
engine cannot prove stays request-controlled rather than assumed safe.

### Rendered evidence is preserved per route and per run

Every rendered-UI invocation wrote `desktop.png`, `tablet.png`, `mobile.png`, and `console.json` to
one fixed directory, so inspecting a second route destroyed the first route's evidence and
re-running a route destroyed its own history. Evidence is now written to
`.forge/evidence/ui/<revision>/<run-id>/<route-id>/`. The route identifier combines a sanitized
single path segment with a hash of the normalized URL, so query strings, fragments, and traversal
sequences cannot influence the directory layout. URL credentials are rejected outright and query
values are redacted before reaching any artifact or directory name. Manifests record the revision,
timestamp, redacted source and final URL, redirect state, viewport dimensions, driver identity and
version, per-screenshot SHA-256 hashes, console-output hash, authorization state, offline state, and
any limitations. A partial browser failure preserves the honest partial evidence and always closes
the browser.

## Added

- An `environment` ledger in the report schema recording operating system, platform, architecture,
  Node version, Forge version, offline mode, and execution authorization. The field is optional, so
  v0.1.3 and v0.1.4 reports continue to load and render; a legacy report states that the record is
  absent rather than having plausible values back-filled into it.
- `npm run check:install-docs`, which fails the build when documentation presents the unpublished
  npm registry installation as a command that works today.

## Changed

- The README now leads with the Git-tag installation that actually resolves. The npm registry form
  is retained only under an explicit "after npm registry publication" heading and marked
  `NOT YET AVAILABLE`; the package is not on the registry and no registry publication is claimed.
- `docs/CLI_REFERENCE.md` documents the offline contract, the browser-driver trust rules, and the
  rendered-evidence layout. `docs/SECURITY_MODEL.md` records the corresponding controls.

## Installation

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.1.5
npx forge init all --dry-run
npx forge init all
```

## Known limitations

Analysis remains bounded and intra-file; unsupported languages and framework shapes stay
`NOT_VERIFIED`. Rendered-state criteria stay `NOT_VERIFIED` wherever no trusted browser driver is
available, which is the expected outcome for this repository's own CI. See
`docs/RELEASE_VERIFICATION_v0.1.5.md` for the verification record and its pending remote steps.
