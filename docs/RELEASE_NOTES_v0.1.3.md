# Fullstack Forge v0.1.3

Corrective correctness release. An independent audit of v0.1.2 proposed thirteen problem areas; each
was independently reproduced against source before any change was made. Twelve were confirmed
outright, two were narrowed to partially confirmed, and none was accepted on the strength of the
report alone. Every confirmed defect is closed with executable evidence and a regression test.

Classification evidence: [`docs/AUDIT_CLASSIFICATION_v0.1.3.md`](AUDIT_CLASSIFICATION_v0.1.3.md).
Verification record: [`docs/RELEASE_VERIFICATION_v0.1.3.md`](RELEASE_VERIFICATION_v0.1.3.md).

## Fixed — report semantics

- **A refused fix no longer unproves the defect.** When an automatic fix was blocked, the engine
  overwrote the finding's `FAIL` or `WARNING` with `BLOCKED`, discarding proven evidence. Defect
  status, fix-attempt status, and verification status are now distinct: refusal is recorded in a new
  `fix_attempts[]` structure and the defect status is preserved.
- **`--safe` now means something.** The flag was parsed and never read, so `forge all fix` and
  `forge all fix --safe` were identical and both mutated files. The contract is now explicit: `fix`
  plans only and never writes, `fix --safe` executes bounded safe registry entries, and
  `fix --safe --dry-run` plans without writing.

## Fixed — finding identity and verification

- **Findings are instance-specific.** Multiple occurrences of one rule collapsed into a single
  global finding, so fixing one occurrence could not be distinguished from fixing another. Findings
  now carry a stable `instance_id` derived from the rule, the repository-relative path, and the sink
  symbol — deliberately not from line numbers, so unrelated edits do not mint a new identity.
- **Verification is scoped to the original evidence.** Analyzer verification re-ran over the whole
  repository and matched on the rule ID, so an unrelated occurrence elsewhere re-failed a resolved
  finding. It is now scoped to the original evidence paths and matched on instance identity.
- **Dry run executes nothing.** `forge all verify --dry-run --allow-run` still ran project commands.
  A dry run now reports the command it would execute and runs nothing.

## Fixed — ship gates

- Gates are classified as `forge-self`, `audited-application`, or `project-native`. Previously every
  command-backed internal gate was marked `NOT_APPLICABLE` and `required: false` for any project
  that was not Fullstack Forge itself, silently disabling **secret scanning, dependency inspection,
  and license validation for every audited application**. Those gates are now required for ordinary
  projects and fall back to recorded audit evidence when the project exposes no matching command.
- Forge packaging, archive, installer, and platform-synchronisation checks remain self-checks and
  are not demanded of audited applications.
- Removed an unreachable dependency-evidence branch that could never execute.

## Fixed — analyzer data flow

A bounded intra-file taint engine replaces raw-text matching at high-risk sinks. It resolves local
aliases, reassignment, object and array destructuring, template-literal and string-concatenation
propagation, and same-file function-parameter summaries, and it records the source-to-sink path as
trace evidence.

Previously undetected, now detected:

```ts
const id = req.params.id;
db.query(`SELECT * FROM users WHERE id = ${id}`); // FF-SEC-SQL-001
```

Sanitizers now bind to the specific value they were applied to. An unrelated `validate*` call in the
same function no longer suppresses a real finding, and naming a variable `"owner policy"` no longer
counts as an authorization predicate.

This is explicitly **not** whole-program sound. Cross-file propagation, dynamic property access, and
reflective call targets are unresolved and reported as such — never inferred as safe.

## Fixed — discovery

- Repository confidence now uses `git rev-parse --is-inside-work-tree`. The previous check looked
  for `.git/` inside a file walk that excludes `.git`, so it could never be true.
- Workspaces are resolved from declared configuration (`package.json` workspaces,
  `pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `turbo.json`). An undeclared nested manifest — a
  fixture or example — is reported as a low-confidence `nested-package`, not an active workspace.
- Bounded route adapters added for Next.js App Router, Next.js Pages Router, NestJS decorators, and
  Fastify object-form routes. Each record names the adapter that produced it.
- Route visibility inferred from a path name (`/login`, `/health`, `/public`) is now reported at
  `LOW` confidence and discloses that it is a heuristic.

## Fixed — changed scope

Base resolution follows an explicit precedence: `--base`, branch upstream, `origin/HEAD`,
`origin/main`, `origin/master`, local `main`, local `master`. `HEAD` is never used as a fallback —
`merge-base HEAD HEAD` is `HEAD`, which silently hid every committed branch change. When no
meaningful base exists the analysis returns a structured `BLOCKED` naming what was tried.

## Added — analyzer support registry

`cli/src/support.ts` records, per module and language, the analyzer, coverage level, supported
shapes, and unsupported shapes. Missing coverage now reports the specific adapter required:

```
NOT_VERIFIED; missing adapter: module=authorization; language=Python;
framework=FastAPI; required adapter=fastapi-authorization-boundaries
```

## Tests

164 tests, all passing, up from 117 at v0.1.2. No existing test was removed or weakened.

## Release status

This version is prepared and verified **locally**. Tag creation, CI across Linux, Windows, and
macOS, release publication, published-asset checksums, and provenance attestations are recorded as
`BLOCKED` in the verification record and have not been performed.
