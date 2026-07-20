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
- Structural-only protection proof. No analyzer protection is granted from an identifier's name.
  `parse`, `validate`, `assertValid`, `sanitize`, `allowlist`, `assertAllowed`, `requireAllowed`,
  `allowedValue`, `trusted`, and `safe` are discovery hints only: an unknown function with any of
  those names produces no protection at all, and every no-op wrapper leaves the SQL, shell, SSRF,
  redirect, mass-assignment, upload, and AI findings reported. Protection is recognized only from
  bounded structural evidence: an explicitly supported library API with known semantics (a schema
  chain rooted at a supported validation library and terminated by a documented parse entry point),
  a schema operation attached to the exact value, a literal-union or enum membership check, a
  dominating guard whose deny branch terminates, correct sink-specific encoding defined by the
  language specification, a parameterized database call, shell argument separation, or a same-file
  helper whose body is actually analyzed. An identity helper is analyzed and yields nothing.
- Strong destination-map proof. A `const` object of URL strings is not an SSRF defence:
  `http://127.0.0.1:3000/` and `http://169.254.169.254/latest/meta-data/` are both fixed literals,
  and `const` prevents neither `MAP.key = req.query.url` nor `mutate(MAP)`. Suppressing an SSRF
  finding therefore requires all of: a `const` binding that never received request data; a non-empty
  object literal, optionally wrapped in `Object.freeze`; every destination a fixed string literal
  that parses as http(s) with no embedded credentials; every destination classified as external —
  loopback, private, link-local, unspecified, multicast, reserved, shared-carrier, and
  cloud-metadata addresses all fail, including IPv4-mapped IPv6 and trailing-dot `localhost` forms;
  no export of the declaration; no property write, delete, alias into another binding, return,
  export, or pass to a function the engine does not model; and an address guard that is modeled
  rather than named — `isPrivate`, `isLinkLocal`, `isInternal`, and `privateAddress` are discovery
  hints only, and a guard is credited solely when a same-file implementation takes the value under
  test, references it, and decides against concrete non-public address evidence. A guard imported
  from another module is not modeled, so that mitigation stays unverified and the finding is
  reported rather than suppressed; the selected destination flowing directly to the sink, so
  concatenation or interpolation drops the proof; and an explicit redirect constraint at the sink.
  Hostname destinations are accepted but recorded as DNS-dependent: no resolution is performed, so
  DNS rebinding and private A records stay outside the proof.
- Offline command policy. `--offline` reaches every execution path, not only the rendered-UI driver.
  An arbitrary audited-project script is classified `UNKNOWN` — Forge cannot read the transitive
  behavior of a shell pipeline, lifecycle chain, or task runner, and never claims such a script is
  offline-safe. Fullstack Forge implements **no** operating-system network isolation (no namespace,
  seccomp, firewall, or container boundary exists in this codebase), so no sandbox is ever claimed
  and `UNKNOWN` commands are blocked offline rather than "sandboxed". Two exemptions are provable:
  Forge's own repository scripts, recognized by exact definition and only when the audited root is
  canonically the Forge package root; and an explicitly designed cache-only installation check that
  combines an offline package-manager flag with an unreachable registry. Every command carries a
  ledger record stating whether it ran, did not run, or was blocked, and why. A blocked command
  produces no execution record and no typed evidence, so it can never satisfy a release gate.
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

## Build-mode surface

Build mode (`forge new`, `forge feature <slug> [sub]`, `forge resume`) persists state under
`.forge/build/`. It adds its own surface to the controls above rather than reusing report internals:

- **Slug validation.** A feature slug must match `^[a-z0-9][a-z0-9-]{0,63}$` and is rejected
  outright if it is a Windows reserved device name (`con`, `prn`, `aux`, `nul`, `com1`-`9`,
  `lpt1`-`9`) or a reserved word — a build sub-verb,
  `new`/`feature`/`resume`/`all`/`audit`/`fix`/`verify`/`report`, an audit module slug, or a
  platform selector name. A feature can never be mistaken for a command or collide with a reserved
  path segment.
- **Path containment.** Every build-state read or write goes through `resolveInside` plus
  `assertNoSymlinkPath` before touching disk, exactly like report and installer paths — no build
  state write can escape the repository root or follow a symlinked destination component.
- **Fail-closed state loading.** `assertBuildProject` and `assertBuildFeature` validate the full
  shape of a loaded state file — schema version, phases, tiers, evidence record shape, risk
  acceptances, repair counters, blockers — and throw rather than silently repair a malformed or
  tampered file, mirroring the audit report's `readReport` contract.
- **Statuses are never agent-written.** Every criterion status in
  `.forge/build/features/<slug>.json` is producer-derived by the CLI from a real analyzer run, argv
  command execution, structural check, or discovery result. An agent can record a summary, a plan, a
  decision, or an assumption, but never a `PASS`, `FAIL`, or `NOT_APPLICABLE` directly.
- **Redaction of authored strings.** Every agent-authored free-text field — summary, plan summary,
  tier-override reason, decisions, assumptions, discipline reasons, risk-acceptance reasons, blocker
  reasons, and evidence lines — passes through the existing redaction layer before being persisted.
  Structural fields (touched paths, evidence file paths) are deliberately left intact because
  redacting them would corrupt the hash-freshness basis.
- **Build state satisfies zero ship gates.** `forge ship` and `forge all audit` never read
  `.forge/build/` as gate evidence; both always re-derive their own evidence independently, so build
  state cannot be used to manufacture a release gate pass.
- **Reloaded free text is data, not instructions.** On resume, any reloaded plan summary, decision,
  or assumption is treated purely as data. It cannot direct an agent to skip a check, widen scope,
  or treat prior recorded text as new authority — the same untrusted-input posture the rest of this
  document applies to repository content applies to a feature's own prior state.
- **Freshness by content hash, not tree revision.** Each evidence record carries per-file SHA-256
  hashes; reload re-verifies every hash and demotes a record to `NOT_VERIFIED` (recorded, never
  deleted) the moment any underlying file changes, rather than trusting a whole-tree revision
  marker.

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
