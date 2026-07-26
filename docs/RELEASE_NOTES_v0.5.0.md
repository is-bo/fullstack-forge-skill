# Release notes — v0.5.0

Fullstack Forge v0.5.0 makes the v0.4 simple product layer resilient enough for ordinary first-time
use. It corrects incomplete Verify success, supports transparent multi-area audit requests, makes
installation recoverable after interruption, and turns Doctor into the single actionable health
check requested by the product specification.

Remote CI, tagging, publication, provenance, release immutability, and post-publication installation
remain pending until an authorized release workflow runs.

## Added

- Read-only agent recommendations based on a finite set of project/user configuration markers and
  executable-name hints on absolute `PATH` entries. Forge never runs a detected executable and keeps
  `all` as the compatibility default.
- A bounded Doctor update check against the fixed upstream Git tag source. Only canonical stable
  tags are accepted; offline, malformed, and unavailable responses remain warnings.
- Doctor verification that all six bundled generated platform roots still match canonical content.
- Product-layer traceability requirements covering simple commands, Build/Continue, bounded Audit,
  progressive output, resilient installation, Doctor, and the onboarding demo.

## Changed

- `forge audit uploads and file storage` transparently runs the `uploads` and `storage` disciplines.
  Every conjunction side must independently resolve; phrases such as `CI` remain ambiguous errors.
- Install success now presents exact Doctor, Build, Audit, and Help entry points.
- The quickstart demo now continues through Ship and proves the expected fail-closed result when
  release evidence is incomplete.
- Public onboarding, command, platform, troubleshooting, verification, and security documentation
  now describe the v0.5 behavior and host-execution boundaries.

## Fixed

- Verify returns exit 2 when any requested result remains `BLOCKED` or `NOT_VERIFIED`; proven
  findings retain exit 1.
- A changed revision no longer silently rebinds an unrechecked positive finding, scope record, or
  typed gate record. Stale evidence is preserved as a diagnostic and demoted.
- Installation preflights the complete operation, atomically records ownership for absent targets
  before creating them, atomically replaces managed files, and safely resumes from either the prior
  or current package hash after interruption.
- Pre-existing identical files remain unowned unless Forge recorded ownership before creation.
- Two public Markdown command tables now render their alternatives correctly.

## Compatibility and security

- All 42 Audit modules, Build mode, report schema 2, Build schema 2, finding identifiers, state,
  expert commands, platform selectors, archives, and JSON output remain available.
- The simple router continues to orchestrate existing engines. It introduces no evidence producer,
  safe-fix authority, project-command permission, or route by which Build can approve Ship.
- Installer roots remain canonicalized and path-contained, destination links are refused, modified
  and unowned files are preserved, and atomic replacement narrows interruption and partial-write
  risk.
- Agent and update responses are untrusted inputs. Output is finite, bounded, and advisory; missing
  evidence never becomes `PASS`.

## Install

Fullstack Forge is distributed from GitHub rather than the public npm registry. After the immutable
v0.5.0 tag exists:

```bash
npm install --save-dev github:is-bo/fullstack-forge-skill#v0.5.0
npx forge init
npx forge doctor
```

The pinned third-party skills-only copy route remains documented in `docs/GETTING_STARTED.md`. It
does not install the persistent Forge CLI or provide Forge's ownership-aware update/uninstall
lifecycle.

## Known limitations

- Generated structures and installation destinations are validated for all supported agents, but
  every vendor host UI was not launched locally. Named skill invocation remains host-specific.
- Update availability requires Git and, unless `--offline` is used, network access to the fixed
  upstream repository. Failure is an actionable warning, not a health pass.
- Browser, assistive-technology, provider, database, deployment, production, and human policy
  evidence still requires the corresponding environment.
- Local evidence does not prove future remote CI, release publication, provenance, immutability, or
  clean installation from an as-yet unpublished v0.5.0 tag.
