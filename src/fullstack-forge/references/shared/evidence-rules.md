# Shared evidence rules for specialist modules

`fullstack-forge/references/shared/module-contract.md` owns applicability, execution, mutation,
verification, and completion. This file owns the narrower question every generated `forge-*`
specialist asks repeatedly: what counts as evidence, and how an unproven criterion is recorded. Load
it whenever a module reports a status, cites a standard, names a deterministic tool, or writes a
finding. A module playbook states only the criteria specific to its boundary; the rules below apply
to all of them and are deliberately not repeated per module.

## Statuses

Every entry in a module's **Missing-control checks** list is a routing target, not evidence. Each
entry resolves either to direct evidence or to exactly one reasoned status:

- `NOT_APPLICABLE` — a bounded scope proves the concern cannot arise in the affected boundary.
  Available only for a requested formal decision, never as a default for an uninspected item.
- `NOT_VERIFIED` — the criterion applies, but the required evidence, runtime, or analyzer support
  was unavailable.
- `BLOCKED` — the criterion applies and inspection could not proceed: missing access, credentials,
  environment, or a check that could not be run safely.

A missing control is `UNKNOWN`, never proof that the related risk is absent. Absent evidence is
never upgraded to `PASS`, an applicable condition without evidence does not disappear, and a nonzero
exit code is itself evidence that must not be hidden or rewritten.

## Standards

The standards a module lists under **Evidence to collect** are the criteria used while inspecting
that boundary. Naming a standard is not a claim of compliance, certification, or coverage. When a
finding depends on a standard, cite the specific clause or control it relies on rather than the
document as a whole.

## Tools

The deterministic inspectors a module names under **Automated support** provide only their
documented bounded evidence, and only for the shapes they support. When a named inspector is absent,
fails, or does not understand the observed framework or wrapper, record `NOT_VERIFIED` and inspect
the source directly instead of claiming analyzer coverage.

Some modules name no inspector. Those rely on detected project commands and direct manual evidence.
Never report that a dedicated inspector ran when none exists, and never present a playbook heading
as standalone analyzer coverage.

The `forge <module> audit --json` and `fullstack-forge <module> audit --json` commands in each
module's **Commands and tools** section apply only when an explicit audit is requested and the CLI
is installed. Normal feature work does not require them.

## Findings

Formal findings follow `fullstack-forge/references/PROTOCOL.md`. Record the module's inspected
boundary, the relevant tests, direct observations, and every piece of evidence that was unavailable.
Create one finding per actionable cause, and merge duplicate symptoms while preserving every
affected location.

Never hide failed checks or claim that an operation ran when it did not.
