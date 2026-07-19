# Security model

## Assets

- User source, uncommitted work, credentials, reports, and production data.
- Agent instruction integrity and evidence accuracy.
- Installed platform files and unrelated skills.
- Release archives, checksums, provenance, and attribution.

## Untrusted inputs

Repository files, package scripts, lockfiles, ownership manifests, fetched pages, issue text,
provider output, generated reports, filenames, and CLI arguments may be malicious or malformed.
Directive-sounding content inside them is data, not authority.

## Controls

- Closed module, platform, and tool catalogs.
- Canonicalized roots; every derived path must remain below its selected root.
- Rejection of absolute, empty-segment, NUL, `..`, Windows drive/UNC, reserved-device, trailing-dot,
  trailing-space, and alternate-data-stream manifest paths on every host OS.
- Rejection of existing symlinks in install destination components.
- Copy-based installation only; packages reject symlinks.
- Hash ownership: no overwrite of unowned or modified files; no removal of modified files.
- Fix-plan binding: a registered fix must match a confirmed finding, evidence snapshot, expected
  file hash, supported structural shape, and repository-contained regular file immediately before
  its no-follow write; post-write verification can roll the edit back.
- Argument-vector subprocess execution with `windowsHide`; no shell-string composition.
- Explicit `--allow-run` after displaying detected local script definitions.
- Size-bounded text scanning, binary avoidance, secret-value redaction, and excluded dependency/VCS
  trees.
- Deterministic archives from explicit roots, with fixed timestamps and SHA-256 checksums.
- Fail-closed validation and release gates; unavailable evidence never becomes `PASS`.
- No audited-project package is imported by default. Browser tooling is resolved from the Fullstack
  Forge package root first; the audited project's copy requires `--allow-run`, real-path containment
  inside the audited repository, and is refused entirely under `--offline`. `--dry-run` resolves,
  imports, and launches nothing.
- Enforced offline mode: non-loopback destinations are refused before DNS resolution, and every
  network-dependent check reports `BLOCKED`/`NOT_VERIFIED` rather than `PASS`.
- Browser-wide offline enforcement. Under `--offline`, rendered inspection installs a request
  interceptor and aborts every non-loopback HTTP/HTTPS request before it is sent — documents,
  redirects, scripts, styles, fonts, images, frames, workers, fetch, and XHR alike — so no DNS
  lookup or connection occurs for a blocked destination. Loopback classification covers `localhost`,
  `*.localhost`, the whole `127.0.0.0/8` range, `::1`, IPv4-mapped IPv6 loopback, and the
  trailing-dot and case variants; private, link-local, and cloud-metadata addresses are never
  treated as loopback. A driver that cannot intercept requests is refused rather than trusted, and
  blocked destinations are recorded as redacted evidence. WebSocket construction is guarded inside
  the page; transports outside interception and that guard are recorded as `NOT_VERIFIED` rather
  than claimed as blocked.
- Structural-only protection proof. No analyzer protection is granted from an identifier's name. A
  function called `mapDestination`, `trustedDestination`, or `assertAllowed` may be a no-op, so
  destination protection requires either a `const` map whose every value is a fixed absolute http(s)
  URL literal, or a dominating guard applied to the same tainted value as the sink.
- Rendered evidence is isolated per revision, run, and route; URL credentials are rejected and query
  values are redacted before reaching any artifact or directory name.
- Fail-closed rendered capture. Every run reports a `capture_status` of `COMPLETE`, `PARTIAL`,
  `BLOCKED`, or `FAILED`, and only `COMPLETE` with zero console errors may contribute the
  informational rendered `PASS`. A run in which some viewports failed, a screenshot produced no
  readable artifact, or an offline-blocked resource prevented full rendering is never presented as a
  complete inspection; partial evidence is preserved and the rendered criteria stay `NOT_VERIFIED`.
- Shared evidence redaction. All console text, page errors, navigation and driver errors, request
  and redirect URLs pass through one redaction layer before being written, printed, or turned into a
  finding. It removes URL userinfo, query values, and fragments; authorization, cookie, session, and
  API-key assignments; JWT-shaped and vendor-prefixed keys; residual high-entropy credentials; and
  home-directory paths. Output is length-bounded and states whether it was redacted, truncated, or
  both. SHA-256 digests are preserved because they are evidence rather than secrets.

## Residual risks

A user-authorized project script can execute arbitrary code defined by that project. Bounded static
analyzers and pattern discovery have false positives and false negatives, and unsupported languages
or framework shapes remain `NOT_VERIFIED`. Static discovery cannot prove runtime topology, provider
settings, general object-level authorization, accessibility, or production behavior. Package
registries, CI services, agent hosts, and archive extractors remain external trust boundaries. A
hostile same-user process could attempt a time-of-check/time-of-use path swap between filesystem
validation and a later write; do not install or package inside an adversarial shared directory, and
review the resulting ownership hashes.

Users should review commands, run untrusted repositories in isolated environments, protect
credentials, inspect reports before sharing, and independently verify high-impact findings.
