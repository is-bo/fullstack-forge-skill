---
name: forge-i18n
description: Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects. Activate automatically for localized or locale-sensitive products when that concern is relevant to a software-engineering request.
---

# forge-i18n: Internationalization

## Purpose

Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

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

Available deterministic support, where present:

- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.

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

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- Unicode CLDR
- BCP 47
- ECMA-402

## Common production failures

- Detect user-facing hard-coded text and inconsistent translation keys
- Inspect locale negotiation, fallback, pluralization, date, number, currency, time-zone, and collation behavior
- Check text expansion, RTL direction, mirrored layout, Unicode input, and localized metadata

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Replace ad hoc formatting with existing locale utilities
- Add missing fallback keys when translation intent is known

## Approval-required changes

- Changing source copy, locale support policy, or financial formatting rules

## Verification

- Run catalog consistency checks
- Render representative locales and confirm fallback behavior

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Translation quality requires qualified human review
