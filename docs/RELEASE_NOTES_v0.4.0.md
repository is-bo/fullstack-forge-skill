# Release notes — v0.4.0

Fullstack Forge v0.4.0 adds a simple product entrance for first-time and nontechnical users while
preserving the v0.3 Build evidence model, all 42 Audit modules, the Ship gate, reports, state, and
expert commands.

Remote CI, publication, provenance, release immutability, and post-publication installation remain
pending until an authorized tagged release workflow completes.

## Added

- Simple CLI commands: `build`, `continue`, `audit [all|area]`, `fix [area]`, `verify [area]`,
  `ship`, `status`, and `help`.
- A no-argument guided menu for interactive terminals and a deterministic numbered list for
  noninteractive environments.
- A generated `forge` Agent Skill in all six platform roots, bringing the bundle to 46 skills: 42
  Audit modules, the simple router, two expert Build skills, and the master skill.
- Safe natural-language feature IDs with shared secret redaction, reserved-name handling, and
  deterministic collision suffixes.
- Closed natural-language audit-area aliases with explicit ambiguity and typo recovery.
- Concise, color-free terminal reports with plain impact, safe-fix availability, detail paths, and
  next actions; `--details` and `--json` retain technical views.
- Read-only `forge status` and expanded `forge doctor` checks for runtime, Git, bundle/catalog,
  install version/integrity, destinations, repository state, project commands, optional UI tooling,
  Build state, and report freshness.
- Goal-oriented onboarding guides plus a packaged, tested quickstart demo of Audit → Fix preview →
  bounded safe fix → Verify → honest Ship blocking.

## Changed

- Human install/update/uninstall output now confirms version, scope, agent destinations, skill
  count, file actions, and the next command. JSON output is unchanged.
- `forge audit` chooses changed scope only when a reliable Git base exists and otherwise announces
  full scope. `forge audit all` always means full applicable audit.
- `forge fix` is a visible no-write preview; `--safe` remains the explicit bounded write authority.
- Platform generators, validators, archives, smoke tests, and offline tests require the new `forge`
  skill and exactly 46 installed skills.

## Compatibility and security

- Existing `forge new`, `feature`, `resume`, `migrate`, `<section> <mode>`, `all`, `ship`,
  installer, tool, and report commands remain available. No finding ID, report schema, or Build
  state schema changed.
- The simple layer supplies no new evidence producer and no new path to `PASS`. Missing evidence,
  unavailable adapters, and unauthorized commands remain `NOT_VERIFIED` or `BLOCKED`; Build state
  still satisfies zero Ship gates.
- Interactive choices are closed, command execution remains argument-vector based, feature text is
  redacted before storage, and all existing root, link, ownership, hash, revision, and safe-fix
  checks remain active.
- Boundary analyzers exclude conventional test sources from production-flow findings. Secret
  inspection still scans tests and ignores only low-confidence values explicitly marked as
  synthetic; recognizable credential signatures remain findings in every source class.
- Forge self-release identity is bound to the canonical executing package root rather than a package
  name or script. Its application-runtime gates are inapplicable only at that trusted root; unknown
  capability evidence in ordinary projects remains required and `NOT_VERIFIED`.
- Runtime pattern inspection excludes generated platform skills and other non-application evidence
  by classified path role, while secret, CI, and configuration scanners retain their intended
  broader coverage.
- The lockfile includes `brace-expansion` 5.0.8, resolving GHSA-mh99-v99m-4gvg in ESLint's
  transitive development dependency tree.

## Install

Fullstack Forge is not published to the npm registry. After the immutable v0.4.0 tag exists:

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.4.0
npx forge init all
npx forge doctor
```

The pinned third-party skills-only alternative is documented in `docs/GETTING_STARTED.md`. It does
not install a persistent Forge CLI or use Forge's ownership manifest.

## Known limitations

- Host applications differ in whether a named Agent Skill appears as `/forge`, `$forge`, a picker
  entry, or automatic selection. Filesystem structures are verified; every host UI was not launched
  locally.
- TTY logic is covered through the pure menu model and CLI noninteractive E2E tests; an automated
  Windows pseudo-terminal interaction was not available in the local gate.
- The external skills installer is third-party and time-sensitive. v1.5.20 copy installation was
  verified; the first-party installer remains authoritative for Forge-specific lifecycle safety.
- Browser, assistive technology, database, provider, deployment, production, and human policy
  evidence still requires the corresponding environment. Absence never becomes `PASS`.
