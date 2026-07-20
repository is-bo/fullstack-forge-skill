# Release notes — v0.1.9

Audit orchestration and report-output milestone.

Before this release a `forge <section> audit` was static-only. Anything that required running a
project command or a browser lived in a separate `forge tool` invocation whose result never reached
the report. An audit therefore produced a document that was silent about everything it had not
looked at. This release makes one audit invocation coherent: it names every check it intends to
perform, executes only what it is explicitly authorized to execute, and records every check that did
not run together with the reason.

## An audit now plans before it acts

A `PlannedCheck` list is built before anything executes, and it is deterministic: modules are
sorted, project commands follow a fixed allowlist order, and runtime evidence is always last. Two
audits of the same checkout produce the same plan on any machine.

Every planned check reaches exactly one terminal outcome. There is no path on which a check is
planned and then silently forgotten. `--json` output gains `planned_checks`, `check_outcomes`,
`runtime_evidence`, and `evidence_complete`.

New options that change behaviour rather than being parsed and ignored:

- `--check <name>` and `--skip-check <name>`, repeatable, accepting the full check identifier or the
  bare name. An unknown value is an error, not a silent no-op — an operator who types `--check lnit`
  must not be told the audit passed with the lint check quietly absent.
- `--url <url>` integrates rendered-UI evidence from an application the operator has already
  started.
- `--evidence-dir <path>` relocates collected runtime evidence beneath the audited root.

## Nothing runs that was not authorized

A default audit remains static-only. Project-command execution requires explicit `--allow-run` and
is restricted to a bounded allowlist of read-only scripts, so `start`, `dev`, `serve`, `deploy`, and
`publish` are not merely excluded — they are unreachable. An audit can never become the thing that
starts or exposes the audited system. Commands run as a bounded argument vector, never as a shell
string. Browser tooling is never installed automatically, and Forge never launches an application:
`--url` requires one that is already running.

## Behaviour change: `--offline` refuses arbitrary project commands

**This changes the output of `forge <section> audit --offline --allow-run`.**

An earlier state of this branch decided offline safety by scanning a script's definition for network
keywords. A command containing none — `eslint .`, `vitest run`, `tsc -p .` — was executed under
`--offline`.

That inference is unsound, and the defect was reproduced before it was fixed. Inspecting text can
prove that a command reaches the network; it can never prove that it does not. Fullstack Forge
implements no operating-system network isolation, so there is nothing to make the guess safe. The
sandbox is, and is reported as, `none`.

Planned checks now carry a `network_policy` obtained exclusively through `plannedCheckNetworkPolicy`
— the single sanctioned bridge into the report vocabulary, introduced in v0.1.8 for exactly this
purpose. The rules:

- Forge-owned scripts matched by exact definition, and proven cache-only installation commands, are
  `OFFLINE_SAFE` and may run. These are the only two structurally provable exemptions.
- Every arbitrary audited-project command is `UNKNOWN` and is blocked under `--offline`.
- Keyword scanning may escalate `UNKNOWN` to `NETWORK_REQUIRED`. Nothing may downgrade a command to
  `OFFLINE_SAFE`.
- A blocked command never produces PASS gate evidence.

If you relied on `--offline --allow-run` executing your project's scripts, re-run without
`--offline` and record that the result was obtained with network access.

## Requested evidence fails closed

A rendered capture that comes back `PARTIAL`, `BLOCKED`, or `FAILED` leaves the rendered criteria
`NOT_VERIFIED` and makes the audit exit `2`. Exit `1` still means a proven defect; exit `2` means
nothing failed, but the run did not prove what it was asked to prove. Runtime evidence requested
under `--offline` is refused rather than attempted, and that refusal also marks the evidence
incomplete.

## Not-run is not the same as blocked

A check nobody authorized is recorded `NOT_RUN`, never `BLOCKED`. `BLOCKED` marks a defect whose
remediation is obstructed and feeds the `forge fix` candidate set; an unauthorized check is not a
defect awaiting remediation, and treating it as one breaks `forge all fix --safe --allow-run`.
`BLOCKED` is reserved for the two refusals Forge itself made: offline policy and failed-closed
evidence.

## Report output is contained and owned

`forge <section> report` renders Markdown to stdout, JSON under `--json`, and writes `report.json`
plus `report.md` under `--output <directory>`; `--dry-run` prints the planned paths and writes
nothing. Report mode never re-runs an audit, so the rendered document preserves the identity,
revision, timestamps, and evidence of the run it names.

The output directory is resolved beneath the authorized root. Traversal, absolute, drive-qualified,
UNC, and symlinked destinations are refused. Forge records the digest of each file it writes and
refuses to overwrite either an unowned pre-existing file or managed output that was edited after
Forge wrote it. Identical content is preserved rather than rewritten.

## Evidence reaches the report through the v0.1.8 ledgers

Orchestration does not write report fields directly. It emits four kinds of fact across an
`AuditLedgerSink` boundary, and `ReportAuditLedger` persists them into the v0.1.8 typed
`planned_checks`, `runtime_evidence`, and `tools` ledgers using the append-only `cli/src/ledger.ts`
API. That API refuses to rewrite a blocked or unverified result as passing, so the honesty invariant
is enforced by the ledger rather than by each caller remembering to be careful.

An executed project command is recorded as a `project-owned`, `untrusted` tool with an `unknown`
version source. Forge did not author it and cannot attest to what it checked.

## Upgrading

No report migration is required: the schema is unchanged from v0.1.8. Tooling that parses `--json`
audit output gains four new top-level fields and should ignore unknown fields as before.

See [the CLI reference](CLI_REFERENCE.md) for the full option and policy documentation, and
[the release verification record](RELEASE_VERIFICATION_v0.1.9.md) for the evidence gathered before
this tag was created.
