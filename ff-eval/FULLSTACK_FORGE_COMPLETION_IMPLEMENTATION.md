# Fullstack Forge — completion implementation report

**Status: the five planned workstreams are implemented, integrated and verified.** The external
corpus benchmark and release-readiness scoring were **deliberately descoped** and were not
performed; see [Descoped work](#descoped-work). Nothing here is estimated or inferred, and no claim
is made about a check that was not run.

## Candidate identity

This document deliberately records **no candidate SHA and no commit count**. A report that names its
own candidate SHA invalidates itself the instant it is committed, because the commit that records
the SHA changes the SHA; "N commits ahead" fails the same way. Only facts that do not change when
this file changes are written down:

| Item            | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Repository      | `is-bo/fullstack-forge-skill`                                             |
| Branch          | `fix/complete-external-readiness`                                         |
| Baseline `main` | `3f73177654f9c7a58a93b83d33c1afa46d86caca` (PR #53)                       |
| Pull request    | https://github.com/is-bo/fullstack-forge-skill/pull/54 (open, not merged) |
| Package version | `0.1.0`, unchanged                                                        |
| Tag / release   | None created                                                              |

Volatile evidence — candidate commit, commits ahead, working-tree cleanliness, Node, platform and
the CI run — is generated at verification time by `scripts/verification-evidence.mjs` and appended
to the GitHub Actions job summary of the run that actually executed the checks. Reproduce it with:

```bash
node scripts/verification-evidence.mjs --baseline 3f73177654f9c7a58a93b83d33c1afa46d86caca
```

## Defects found and fixed

### 1. Any nested repository aborted every audit

`git ls-files --others` collapses an untracked nested repository into a single directory entry with
a trailing slash. `normalizeSafeRelative` rejects the empty final segment, so `inventoryRepository`
threw `Unsafe repository inventory path` and aborted before any analysis ran. Any target repository
vendoring a checkout, holding an unregistered submodule, or containing a Git worktree crashed
outright — the exact external-repository readiness class this work exists to close.

Trailing-slash entries are now dropped at the call site, keeping `normalizeSafeRelative`'s traversal
contract strict, and the inventory reports `PARTIAL` with reason `nested-repository-not-inventoried`
so the coverage gap stays visible instead of becoming a silent `COMPLETE`.

### 2. Release archives shipped adapters with no canonical content

Every host adapter is a pointer into `.fullstack-forge/skills/`. The packager never collected that
tree, and `.fullstack-forge` was in the private-path denylist so it would have been rejected had it
tried. The published `dist/*.zip` release assets therefore contained 46 adapters and **zero**
canonical files: extracting any release archive produced an installation in which every pointer
dangled. In-repo tests could not see this because they read the working tree.

`validate-dist.mjs` now resolves each adapter's pointer relative to the adapter's own directory and
asserts the archive contains the target, rejecting escapes outside the canonical root. Verified by
decoding the built archive's central directory: the `claude` archive holds 226 entries including 133
canonical files and 46 adapters; 644 adapters resolve across the 9 archives.

### 3. Unrelated 401/403 middleware proved authorization

`functionDeniesAuthorization` accepted a middleware as an authorization guard when its body text
matched `/\b(?:401|403)\b/` **and** `/\b(?:status|sendStatus|statusCode|code)\b/`. The tokens only
had to co-occur somewhere in the body; nothing connected a predicate to the terminating branch.

Each request-denying site is now located and the conditions that actually control it are walked out
of the AST — enclosing `if`/ternary/logical branches, `switch` subjects, and preceding early-exit
dominators. A branch that also calls `next()` is rejected. A controlling condition qualifies only
when it is not vetoed by an unrelated-concern vocabulary and either carries authorization vocabulary
or structurally tests subject presence.

### 4. Imported upload helpers downgraded proven defects

`importedValidationDelegate` treated any imported function receiving an argument mentioning
`buffer|mimetype|originalname|file` as possible content validation, downgrading a proven HIGH
`FF-UPLOAD-MIME-001` to `NOT_VERIFIED`. A storage, logging, resize or queue helper suppressed a real
defect. A helper now clears a finding only when its resolved body inspects decoded bytes and its
verdict is enforced; an unopened helper downgrades only when it structurally controls acceptance.

### 5. Upload analysis was Multer-only

`analyzeUploadFile` was gated on `/upload\.(?:any|array|fields|single)\s*\(/`, so every non-Multer
flow received no analysis and its silence was indistinguishable from hardened code.

### 6. Severity was aggregated without regard to status

A CRITICAL-severity, LOW-confidence, `NOT_VERIFIED` finding was indistinguishable from a confirmed
CRITICAL defect in any severity-bucketed summary, and `sortFindings` ranked severity first, placing
unproven criticals above confirmed highs. `summarizeFindings` now reports severity **only inside** a
verdict class and publishes no top-level `by_severity`.

### 7. Transaction boundary resolution was scope-blind

`rawBoundary` matched `BEGIN`/`COMMIT` markers across a file-global array with no receiver, scope,
or intervening-terminator check, so a pair in a neighbouring function proved a boundary for
unrelated writes; `BEGIN … ROLLBACK` produced findings on atomic code; and file-global handle sets
let a transaction handle in one function cover writes in another.

## Independent verification of the two safety-critical fixes

Fixtures written by the agent that wrote the code prove less than they appear to. Both analyzer
fixes were therefore probed with cases authored separately by the integrating lead, and each probe
was **also run against the pre-fix analyzer to prove it is not vacuous**.

### Route authorization

| Probe case (a sensitive `DELETE /accounts/:id`)     | Pre-fix   | Post-fix | Required |
| --------------------------------------------------- | --------- | -------- | -------- |
| CSRF token mismatch → 403                           | **CLEAN** | FAIL     | FAIL     |
| Audit logger naming `user` and `403`, then `next()` | **CLEAN** | FAIL     | FAIL     |
| Payload size limit → 403                            | **CLEAN** | FAIL     | FAIL     |
| IP denylist → 403                                   | **CLEAN** | FAIL     | FAIL     |
| Scope/claim guard                                   | CLEAN     | CLEAN    | CLEAN    |
| Ownership guard                                     | CLEAN     | CLEAN    | CLEAN    |

Before the fix a destructive route protected only by a CSRF check — or by an audit logger that
merely mentions the number 403 before delegating — was reported as authorized.

### Upload delegation

| Probe case (imported helper receives the payload)  | Pre-fix          | Post-fix | Required |
| -------------------------------------------------- | ---------------- | -------- | -------- |
| Helper uploads bytes to a CDN                      | **NOT_VERIFIED** | FAIL     | FAIL     |
| Helper computes a SHA-256 checksum                 | **NOT_VERIFIED** | FAIL     | FAIL     |
| Helper named `validateUpload` that only reads size | **NOT_VERIFIED** | FAIL     | FAIL     |
| Helper comparing PNG magic bytes, verdict enforced | **NOT_VERIFIED** | CLEAN    | CLEAN    |

Before the fix all four collapsed to the same answer: the analyzer could not distinguish a CDN
uploader from a magic-byte validator.

## Upload support matrix

`E` extension, `M` client MIME, `P` public-before-approval, `S` scan boundary, `FO` scanner
fail-open, `FN` filename in storage key, `L` limits, `DV` direct-verify. `—` means **not claimed** —
out of evidence, never "passing".

| Family                     | E                                             | M   | P   | S   | FO  | FN  | L   | DV  |
| -------------------------- | --------------------------------------------- | --- | --- | --- | --- | --- | --- | --- |
| Multer                     | ✓                                             | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | —   |
| Busboy                     | ✓                                             | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | —   |
| Formidable                 | ✓                                             | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | —   |
| Next.js `formData()`       | ✓                                             | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | —   |
| Raw multipart              | ✓                                             | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | —   |
| Presigned S3               | ✓                                             | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   |
| Presigned GCS              | ✓                                             | ✓   | ✓   | —   | ✓   | ✓   | ✓   | ✓   |
| Server-side object storage | ✓                                             | ✓   | ✓   | ✓   | ✓   | ✓   | —   | —   |
| Anything else              | reported as `FF-UPLOAD-FLOW-NOT-VERIFIED-001` |     |     |     |     |     |     |     |

Presigned flows never see the bytes server-side, so a scan at signing time would be meaningless;
`DV` asks the equivalent question. A server-side write is past the parser, so `L` is not its
concern.

## Object-authorization policy

`decideObjectAuthorization({ boundPredicate, authority, partition })`. `authority` is what a
**resolved** guard proves; an unread body can never be `global`, which is what keeps a package's
`requireAdmin` out of the clean outcome.

| authority                        | partition     | outcome        | finding                                 |
| -------------------------------- | ------------- | -------------- | --------------------------------------- |
| any, with bound object predicate | —             | authorized     | none                                    |
| `global`                         | `global`      | administrative | `FF-AUTHZ-OBJECT-ADMIN-001` LOW/WARNING |
| `global`                         | `partitioned` | unresolved     | `FF-AUTHZ-OBJECT-NOT-VERIFIED-001`      |
| `tenant`                         | any           | missing        | `FF-AUTHZ-OBJECT-001` FAIL              |
| `ambiguous`                      | any           | unresolved     | `FF-AUTHZ-OBJECT-NOT-VERIFIED-001`      |
| `none`                           | any           | missing        | `FF-AUTHZ-OBJECT-001` FAIL              |

A role name never _clears_ the rule — the best it reaches is a published low-severity note — so a
misclassification degrades to noise rather than silence, and every uncertain case lands on
`NOT_VERIFIED` rather than clean.

## Playbook deduplication

| Measure                     | Before | After  |
| --------------------------- | ------ | ------ |
| **Primary (literal units)** | 32.89% | 23.42% |
| Masked (name/title masked)  | 42.19% | 34.21% |
| Shingle-8 cross-check       | 27.31% | 16.26% |
| Total tokens                | 25,981 | 22,396 |
| Worst file                  | 37.80% | 26.93% |

Target was below 25% primary. Verified independently after integration by re-running
`node scripts/measure-boilerplate.mjs`.

Activation was preserved by construction, and this was checked rather than assumed: the change
alters **zero bytes** under `.agents/`, `.claude/`, `.cursor/`, `.gemini/`, `.github/skills/` and
`.windsurf/`, and **zero** `name:` or `description:` lines anywhere.

Largest deliberate remaining repetition: the 14 section headings `scripts/validate-skill.mjs`
requires; the "Never hide failed checks" sentence that `scripts/lib/skill-validation.mjs` requires
verbatim in every skill; and slug-templated activation lines that are load-bearing for automatic
activation — which is why the masked variant stays higher than the primary.

## Installation and host acceptance

Every host check is an **executable simulation**, never a live host run. No Claude Code, Codex,
Cursor, Gemini, Windsurf or Copilot process was launched. **Live host loader and UI behaviour remain
`NOT_VERIFIED`**, and the test file states this in its header so a green suite cannot be misread.

Simulated and passing for all six host layouts: adapter discovery at the host's documented path,
frontmatter-triggered activation unchanged, canonical playbook reachable through the relative
pointer, references resolving from the canonical root, damaged-installation detection, per-host
update and uninstall isolation, last-uninstall cleanup, preservation of modified canonical content
and modified adapters, legacy full-copy upgrade, interrupted-installation resume, paths containing
spaces, symlink/reparse-point rejection, and installation from the packed npm artifact.

The legacy-upgrade check was split after the implementing agent found its own original assertion
wrong: because the legacy layout and the new adapter occupy the same path, a user-edited playbook is
an update conflict, not a `preserve-modified` case. The installer's refusal is correct — it happens
in preflight before any write, so an aborted upgrade leaves a working previous installation. The
test was corrected to the installer's real behaviour, not the reverse.

## Transaction analyzer review

| Defect class                          | Verdict                                   |
| ------------------------------------- | ----------------------------------------- |
| Raw `BEGIN`/`COMMIT` ordering         | found + fixed                             |
| Rollback-only paths                   | found + fixed                             |
| Custom transaction handles            | found + fixed (two defects)               |
| False positives from unrelated writes | found + fixed (two defects)               |
| Boundaries incorrectly grouped        | no defect found                           |
| Nested transactions                   | found + fixed                             |
| Helper inlining                       | found + fixed (two defects)               |
| Custom wrappers                       | no defect found                           |
| Transaction options into ORM calls    | found + fixed                             |
| Cross-function dataflow limits        | no defect found                           |
| Financial / inventory severity        | precision defects fixed; ladder unchanged |

Inventory severity was deliberately **not** raised to CRITICAL; the documented ladder was preserved.

## Descoped work

The independent external-corpus benchmark and the release-readiness scoring were **not performed**.
They were cut on an explicit instruction after usage became the binding constraint. Consequences,
stated plainly:

- **Analyzer precision is unbenchmarked.** No true-positive, false-positive or false-negative rates
  exist for any rule family against an external corpus.
- The compensating evidence is the two lead-authored probe matrices above, each validated against
  the pre-fix analyzer. That is a targeted regression check, **not** a precision measurement.
- No release-readiness score was computed.

## Known limitations

1. Analyzer precision is unbenchmarked (above).
2. Live host loader and UI behaviour are `NOT_VERIFIED`; all host acceptance is simulated.
3. Authorization vocabularies remain lexical, applied to structurally selected conditions. A guard
   whose predicate uses only domain-specific vocabulary with no subject-presence test reads as
   `none` and fails closed — safe, but a false-positive source.
4. The unrelated-concern veto is absolute, so a predicate that also names a vetoed concern (for
   example `req.user.plan.allowsDelete`) will not clear a route. Intended per the specification's
   treatment of billing as non-authorization, but a real precision boundary.
5. `FF-UPLOAD-DIRECT-VERIFY-001` is `NOT_VERIFIED` by construction, never FAIL: a verifier can
   legitimately live in a worker this file never mentions.
6. Upload effect-role classification is a name list. It is one-directional — it can only preserve a
   FAIL, never prove safety — but an unresolved helper named `processUpload` that genuinely
   validates will FAIL rather than downgrade.
7. Transaction analysis misses pairs keyed by a natural key such as `sku`, relates raw SQL only by
   dataflow, and treats a reassigned transaction handle as one boundary.
8. Two new authorization finding IDs (`FF-AUTHZ-OBJECT-ADMIN-001`,
   `FF-AUTHZ-OBJECT-NOT-VERIFIED-001`) and two new upload IDs are introduced; consumers pinning the
   previous ID set will see them.
9. Playbook boilerplate is a proxy metric. No before/after activation or audit-quality evaluation
   was run, so whether shorter playbooks route an agent to the extracted reference as reliably as
   the inlined prose did is unmeasured.

## No release actions

No merge, tag, release, package publication, version bump, or change to public release history was
performed by this work.
