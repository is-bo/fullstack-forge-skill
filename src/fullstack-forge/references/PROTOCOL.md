# Evidence protocol

## Status

- `PASS`: affirmative direct evidence shows the criterion holds in the inspected scope.
- `FAIL`: evidence demonstrates a defect or violated required criterion.
- `WARNING`: evidence shows material risk, drift, or an improvement that is not a demonstrated
  failure.
- `NOT_APPLICABLE`: discovery evidence shows the criterion is outside the actual product boundary.
- `NOT_VERIFIED`: the criterion applies, but required direct evidence was unavailable or not run.
- `BLOCKED`: a named dependency or safety boundary prevented the check from completing.

A pass needs code with file and line evidence, a successful automated check, an inspected running
application, a behavior-demonstrating test, or verified configuration output. Silence, convention,
and absence of a simple pattern are not passes.

## Confidence

- `HIGH`: reproduced behavior, successful check, or direct configuration/runtime evidence.
- `MEDIUM`: complete static trace across the relevant boundaries without runtime confirmation.
- `LOW`: credible partial evidence with a missing or ambiguous boundary.

Confidence describes evidence quality, not impact. A critical, low-confidence signal stays critical
until triage establishes otherwise.

## Evidence records

Record the smallest reproducible evidence:

- Code/configuration: repository-relative path, 1-based line, and a concise observation.
- Command: argument vector, working directory, exit code, relevant output, and timestamp.
- Test: test name, setup, assertion, and result.
- Running UI/API: URL or endpoint, role, input, viewport/device where relevant, and observed result.
- External configuration: provider, environment, retrieval method, and non-secret output.

Never include secrets, raw credentials, full personal records, or unnecessary payloads. Redact a
value without erasing the fact that the value was observed.

Release-significant Audit and Ship evidence uses the v0.3 typed envelope. A record is eligible only
when its domain, registered producer/version/contract, exact criterion/status, canonical root,
working-tree revision, production/expiry times, outer-claim digest, and one-to-one
path/SHA-256/media-type artifacts verify. Registered command evidence also binds its detected
definition, argv, input manifest, exit code, duration, and output digest. Re-hash artifacts at
consumption. Treat legacy, expired, cross-root/revision, unregistered, malformed, changed, and
Build-domain records as diagnostics, never release proof. The envelope proves local integrity and
freshness; it does not expand the producer's bounded coverage or serve as an external signature.

## Finding lifecycle

Use a stable module prefix and monotonically increasing suffix. Preserve an identifier across
reports. Verification appends new evidence and changes status; it never rewrites the initial
observation. If one cause affects many locations, keep one finding and list every location. If
symptoms have distinct fixes or risks, keep them separate.

## Safe execution

Inspect scripts before running them. Prefer pinned local tools and existing project commands. Do not
run installers, hooks, migrations, deploys, destructive commands, or networked scanners implicitly.
Store unavailable checks as `NOT_VERIFIED` and explain the missing evidence.
