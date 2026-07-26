# Fullstack Forge v0.1.4

v0.1.4 is a security-correctness and release-integrity patch. It makes taint protection
sink-specific, makes authorization proof structural, completes instance-specific fix lifecycle
handling, replaces broad ship-gate inference with typed evidence, removes scanner fixtures from the
dependency graph, and makes future releases non-clobbering and immutable.

Classification record: [`docs/AUDIT_CLASSIFICATION_v0.1.4.md`](AUDIT_CLASSIFICATION_v0.1.4.md).
Tagged local record: [`docs/RELEASE_VERIFICATION_v0.1.4.md`](RELEASE_VERIFICATION_v0.1.4.md). Final
remote verification is pending and will be published by the tag workflow as
`FINAL_RELEASE_VERIFICATION_v0.1.4.md` plus its checksum. That final asset is generated after the
tag and is not represented as content of tagged source.

## Analyzer correctness

- Generic parse, validation, normalization, escaping, or encoding no longer clears taint. Values
  retain their origin and carry typed protection evidence such as parameterized, shell-separated,
  allowlisted, trusted-origin, or network-constrained.
- SQL parameter binding and fixed executable/validated argument arrays are recognized only for the
  corresponding sink class. SSRF allowlists remain tied to the actual destination, require redirect
  control, and are invalidated by later raw reassignment.
- Authorization requires a final owner/tenant predicate or a dominating guard connected to both
  authenticated subject and object. Policy words, comments, unused imports, later calls, and guards
  for another object are not evidence.
- The bounded analyzer still does not claim whole-program soundness.

## Instance-specific evidence and safe fixes

Finding instances now derive from rule, path, containing declaration, receiver, sink, normalized AST
shape, and deterministic same-scope occurrence. Exact identity flows through analyzer verification,
safe-fix planning and writes, blocked attempts, public JSON, Markdown, ship evidence, report
updates, and rollback. v0.1.3 reports without instance-specific fields remain readable.

Fix and verification transitions recompute report revision, retain prior typed gate and coverage
evidence, and attach `ROLLED_BACK` attempts only to the affected instance. Structurally identical
peers retain their identity when a sibling becomes safe.

The public JSON Schema was also corrected to describe the runtime `instance_id`, `fix_attempts`, and
scoped analyzer action fields.

## Exact ship gates and adapter coverage

Ship gates accept only their declared evidence types and require current revision/timestamp
evidence. A SQL or SSRF result cannot masquerade as secret scanning; dependency, lockfile, license,
authorization, tenant, upload, migration, test, and release-artifact evidence remain independent.

Normal JSON and Markdown audit output now records analyzer coverage for every detected
language/framework in selected modules. FastAPI and Django are distinguished, unknown Python stays
unknown, and Go, Rust, JVM, mixed-language, and partial JavaScript/TypeScript gaps name the adapter
that would close them.

## Dependency and workflow hygiene

- Scanner fixtures are stored as non-installable `package.json.fixture` data and materialized only
  inside disposable test projects. A fail-closed fixture validator prevents real manifests,
  lockfiles, scripts, symlinks, or non-sentinel versions from returning.
- Secret scanning subtracts deleted tracked worktree paths while continuing to scan untracked files,
  so manifest renames cannot crash or silently narrow local validation.
- Root dependency audit reports no known vulnerability. TypeScript 7 and `@types/node` 26 remain
  intentional major ignores to preserve the supported TypeScript ESLint peer range and Node 24 API
  baseline.
- GitHub Actions are pinned to reviewed full commit SHAs for checkout v7, setup-node v7,
  upload-artifact v7.0.1, dependency review v5, provenance attestation v4.1.1, and CodeQL v4.
- A least-privilege no-build CodeQL workflow now scans JavaScript/TypeScript on pull requests,
  `main`, a weekly schedule, and manual dispatch.

## Coverage and release integrity

Coverage now fails CI below committed overall and high-risk file floors; statements are explicitly
unmeasured because the Node.js reporter exposes lines, branches, and functions only. Generated
Markdown and package copies are checked by synchronization and deterministic packaging rather than
misrepresented as executable coverage.

The tag workflow:

1. proves the annotated tag commit and absence of an existing release;
2. runs checks, enforced coverage, dependency audit, packaging, smoke install, and offline install;
3. creates one draft and uploads without `--clobber`;
4. attests every initial asset, downloads the exact expected set, and compares archive, checksum,
   and manifest bytes;
5. adds a checksummed and attested final evidence asset;
6. publishes exactly once; and
7. verifies GitHub immutable release state, asset attestations, and the remote tag commit.

Repository immutable releases are enabled for future publication. Existing tags and releases were
not moved, recreated, or modified.

## Install

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.1.4
npx forge init all
```

Or download the agent-specific ZIP from the GitHub release, verify it against `SHA256SUMS.txt`, and
extract it at the repository root. The release contains nine deterministic ZIP archives,
`SHA256SUMS.txt`, `manifest.json`, and the two final evidence assets.

## Compatibility and limitations

- Node.js 24 or newer remains required; CLI command and 42-module catalog compatibility is retained.
- Python, Go, Rust, and JVM security/authorization adapters remain `NOT_VERIFIED` gaps.
- Cross-file data flow, dynamic properties, reflective calls, middleware inheritance, and production
  controls remain outside bounded static proof.
- Runtime accessibility, database, backup, malware scanning, provider, deployment, and operator
  checks still require direct evidence.
- The project is not published to the npm registry; repository/tag and release-archive installation
  are the supported publication paths for this release.
