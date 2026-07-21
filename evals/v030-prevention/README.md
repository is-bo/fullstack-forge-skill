# v0.3 prevention evaluation corpus

This public, offline corpus evaluates whether Build-mode planning prevents twelve concrete
implementation failures. `cases.json` is intentionally declarative: the runner materializes only the
fixed `starting_repository.file_map` entries in a temporary directory and never executes source
text, commands, URLs, or instructions from a case.

Every case has a fixed agent task, a materializable repository, expected disciplines and gates,
negative assertions, and required validation artifacts. Each validation check is classified as one
of four kinds:

- `deterministic`: the committed test can prove it locally and repeatably.
- `nondeterministic`: workload- or environment-dependent evidence; it begins `NOT_VERIFIED`.
- `human-required`: a reviewer must inspect or perform it; it begins `NOT_VERIFIED`.
- `unsupported-external-tool`: the corpus has no approved provider/browser/service adapter; it
  begins `BLOCKED`.

Only deterministic checks may be `PASS`. A case never converts unavailable provider, browser, or
human evidence into a pass. The focused runner is `cli/tests/v030-prevention-evals.test.ts`.
