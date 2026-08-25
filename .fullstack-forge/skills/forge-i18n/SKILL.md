---
name: forge-i18n
description: "Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects."
---

# forge-i18n: Internationalization

Engine: Forge native

## Purpose

Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" i18n compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves internationalization, when
the user explicitly names `forge-i18n`, or when discovery proves an applicable boundary.

- Localized or locale-sensitive products
- Products handling names, addresses, dates, currency, or pluralization

## When not to activate

- Locale-neutral internal protocols

## Automated support

Relevant discovery inputs are:

- locale catalogs
- routing and middleware
- formatting utilities

Deterministic support, bounded evidence only:

- None; use detected project commands and direct manual evidence.

## Agent inspection procedure

1. Inventory user-facing strings and locate hard-coded literals outside the translation system.
2. Compare message catalogs for completeness across supported locales and record missing or stale keys.
3. Render representative screens in Arabic (RTL), French, and English, checking direction, alignment, mixed-direction text, and expansion overflow.
4. Trace date, time, number, and currency values from storage to display and verify locale-aware formatting at the display boundary, with time zones handled at the edges.
5. Check pluralization rules, sorting and collation, and locale persistence across sessions and communication channels (emails, PDFs, errors).

Manual inspection requirements:

- Review culturally sensitive copy and incomplete translations
- Exercise representative RTL and long-string layouts

Stack-specific guidance:

- Use the detected framework's routing and message extraction conventions

## Evidence to collect

Standards used as criteria:

- Unicode CLDR
- BCP 47
- ECMA-402

## Common production failures

- Detect user-facing hard-coded text and inconsistent translation keys
- Inspect locale negotiation, fallback, pluralization, date, number, currency, time-zone, and collation behavior
- Check text expansion, RTL direction, mirrored layout, Unicode input, and localized metadata

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Hard-coded user-facing strings
- Translation completeness
- RTL layouts
- Mixed LTR and RTL content
- Date formatting
- Time formatting
- Time zones
- Currency formatting
- Number formatting
- Locale-aware sorting
- Pluralization
- Unicode
- Text expansion
- Phone-number formats
- Address formats
- Name formats
- Localized emails
- Localized PDFs
- Localized errors
- Locale persistence
- Language fallbacks
- Arabic, French, and English compatibility

## Commands and tools

- Run `forge i18n audit --json` or `fullstack-forge i18n audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Replace ad hoc formatting with existing locale utilities
- Add missing fallback keys when translation intent is known

## Approval-required changes

- Changing source copy, locale support policy, or financial formatting rules

## Verification

- Run catalog consistency checks
- Render representative locales and confirm fallback behavior

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Translation quality requires qualified human review
