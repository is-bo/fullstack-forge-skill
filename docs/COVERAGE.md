# Coverage policy

`npm run test:coverage` executes the complete test suite with the Node.js 20, 22, or 24 experimental
coverage reporter, parses its machine-readable table, and fails when the measured result falls below
`config/coverage-thresholds.json`. The TypeScript build intentionally omits external source maps:
the published package does not include their TypeScript targets, and Node 20 cannot reliably report
coverage from those maps.

## v0.1.4 measured baseline

The final pre-release measurement is recorded in `docs/RELEASE_VERIFICATION_v0.1.4.md`. The
committed floors are intentionally below, but close to, the measured baseline so small reporter or
platform variance does not create noise while meaningful regressions fail CI.

| Scope             | Lines | Branches | Functions |
| ----------------- | ----: | -------: | --------: |
| Overall floor     |   88% |      76% |       87% |
| `analyzers.js`    |   94% |      78% |       90% |
| `dataflow.js`     |   90% |      80% |       92% |
| `discovery.js`    |   92% |      78% |       88% |
| `finding.js`      |   92% |      60% |       84% |
| `fixes.js`        |   93% |      60% |       90% |
| `gates.js`        |   92% |      75% |       88% |
| `installer.js`    |   88% |      76% |       80% |
| `scope.js`        |   94% |      84% |       94% |
| `verification.js` |   68% |      54% |       72% |

Release, archive, fixture, and filesystem safety libraries have additional file-level floors in the
JSON configuration. Node's selected reporter does not expose a separate statement metric, so
statements are explicitly recorded as unmeasured rather than inferred from lines.

Generated platform Markdown, declaration files, images, and packaged ZIP copies are not executable
coverage targets. They are checked independently through generator synchronization, schema
validation, deterministic packaging, archive inspection, smoke installation, and offline
installation. Coverage supports review; it is not evidence of whole-program security or runtime
correctness.
