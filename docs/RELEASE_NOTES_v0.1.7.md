# Release notes — v0.1.7

Offline command policy and structural security proof milestone.

This release closes two defects in which Fullstack Forge reported a stronger guarantee than it
actually enforced. Both were reproduced against the v0.1.6 implementation before remediation and are
covered by regression tests that fail against it.

## `--offline` is enforced on every command execution path

`--offline` previously reached only the rendered-UI driver. `forge tool run-project-command` and
every `forge ship` gate spawned the audited project's own scripts with unrestricted network access
while the report recorded `offline: true` — a silently ignored flag and a false offline claim.

Classification now happens in one place and every execution path consults it. The model is
deliberately small and pessimistic:

- An arbitrary audited-project script is classified `UNKNOWN` from its **definition**, never its
  name. `test`, `lint`, or `verify:offline` say nothing about what a script does.
- Fullstack Forge implements **no** operating-system network isolation. No namespace, seccomp,
  firewall, or container boundary exists in this codebase, so none is claimed: `sandbox` is always
  reported as `none`, and `UNKNOWN` commands are blocked offline rather than "sandboxed".
- Exactly two exemptions are structurally provable: Forge's own repository scripts, matched by exact
  definition and only when the audited root is canonically the Forge package root; and an explicitly
  designed cache-only installation check that combines an offline package-manager flag with an
  unreachable registry.

Every command now carries a ledger record (`RAN`, `BLOCKED`, `NOT_RUN`) with its reason. A blocked
command produces no execution record and no typed evidence, so it can never satisfy a release gate.

## Analyzer protection is granted only from analyzed structure

Protection is no longer granted from a function's name. `parse`, `validate`, `assertValid`,
`sanitize`, `allowlist`, `assertAllowed`, `requireAllowed`, `allowedValue`, `trusted`, and `safe`
are discovery hints only; a no-op function with any of those names now leaves the SQL, shell, SSRF,
redirect, mass-assignment, upload, and AI findings reported.

SSRF address guards are covered by the same rule. `isPrivate`, `isLinkLocal`, `isInternal`, and
`privateAddress` were still credited from the callee name alone, so a no-op guard —
`function isPrivate(value) { return false; }` — suppressed the SSRF finding while blocking nothing,
contradicting the documented claim that no protection is granted from an identifier's name. A guard
is now credited only when a same-file implementation is analyzed: it must accept the value under
test, reference it, and decide against concrete loopback, private, or link-local address evidence. A
constant-returning body proves nothing. Genuine structurally proven address guards continue to
suppress.

Destination maps likewise require strong proof. A `const` object of URL strings is not an SSRF
defence: `http://127.0.0.1:3000/` and `http://169.254.169.254/latest/meta-data/` are fixed literals
and exactly the destinations an SSRF attack wants, and `const` prevents neither
`MAP.key = req.query.url` nor `mutate(MAP)`. Suppression now requires fixed literal destinations,
demonstrable immutability, no property write or delete, no alias escape, no export or return, no
pass to an unmodelled function, direct flow to the sink, an explicit redirect constraint, absent
credentials, a supported protocol, and classification of literal addresses.

## Known limitations

- An address guard imported from another module or a package is **not** modeled. That mitigation is
  reported as unverified rather than credited, so the SSRF finding is raised. This is deliberate: an
  unread implementation cannot be proven to block anything.
- Hostname destinations are accepted but recorded as DNS-dependent. No resolution is performed, so
  DNS rebinding and private A records stay outside the proof.
- No operating-system network isolation exists. Offline enforcement is a policy decision about
  whether to spawn a command, not a sandbox.

## Verification

Local validation evidence gathered before the tag is recorded in
`docs/RELEASE_VERIFICATION_v0.1.7.md`. Remote CI, publication, provenance, and immutable-release
checks are pending at tag time and are recorded separately after publication.
