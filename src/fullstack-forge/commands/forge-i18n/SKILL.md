---
name: forge-i18n
description: Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects. Activate automatically for localized or locale-sensitive products when that concern is relevant to a software-engineering request.
---

# forge-i18n: Internationalization

Engine: Forge native

## Purpose

Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

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
