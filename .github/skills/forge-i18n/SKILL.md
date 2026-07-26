---
name: forge-i18n
description: Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects. Activate automatically for localized or locale-sensitive products when that concern is relevant to a software-engineering request.
---

# forge-i18n: Internationalization

## Purpose

Find locale, translation, formatting, expansion, fallback, and bidirectional-layout defects.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves internationalization, when
the user explicitly names `forge-i18n`, or when discovery proves an applicable boundary.

- Localized or locale-sensitive products
- Products handling names, addresses, dates, currency, or pluralization

## When not to activate

- Locale-neutral internal protocols

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- locale catalogs
- routing and middleware
- formatting utilities

Available deterministic support, where present:

- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Inventory user-facing strings and locate hard-coded literals outside the translation system.
3. Compare message catalogs for completeness across supported locales and record missing or stale keys.
4. Render representative screens in Arabic (RTL), French, and English, checking direction, alignment, mixed-direction text, and expansion overflow.
5. Trace date, time, number, and currency values from storage to display and verify locale-aware formatting at the display boundary, with time zones handled at the edges.
6. Check pluralization rules, sorting and collation, and locale persistence across sessions and communication channels (emails, PDFs, errors).
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review culturally sensitive copy and incomplete translations
- Exercise representative RTL and long-string layouts

Stack-specific guidance:

- Use the detected framework's routing and message extraction conventions

## Evidence to collect

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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
- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Replace ad hoc formatting with existing locale utilities
- Add missing fallback keys when translation intent is known

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Changing source copy, locale support policy, or financial formatting rules

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Run catalog consistency checks
- Render representative locales and confirm fallback behavior

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Translation quality requires qualified human review

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
