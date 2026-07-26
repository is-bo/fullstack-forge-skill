# Accessibility integration

Owner: `forge-accessibility`. This file only explains how frontend, UI, and UX work compose with
that module; it intentionally does not duplicate the WCAG checklist.

## Load when

- Any request creates, changes, or reviews a human-facing interface.

## Do not load when

- The work has no human-facing output or interaction.

## Integrate early

Choose native platform controls and semantic structure before styling. Define accessible name, role,
state, keyboard or platform interaction, focus entry and restoration, error announcement, status
announcement, target behavior, contrast, zoom, text resizing, and reduced-motion handling as part of
the component or journey contract.

Route detailed conformance work to `forge-accessibility`. Route localized direction and expansion to
`forge-i18n`. Do not let UI guidance invent competing thresholds or treat an automated scan as full
coverage.

For custom widgets, identify the applicable platform pattern and test its complete interaction.
Avoid ARIA or accessibility props that contradict native semantics. Ensure color, placement, motion,
and iconography are never the only carrier of meaning.

## Evidence

- Automated results plus the manual gaps they cannot cover.
- Keyboard-only journey evidence and focus restoration for web interfaces.
- Accessibility-tree or assistive-technology evidence when actually captured.
- Exact WCAG 2.2 AA criteria for conformance findings; otherwise state the product principle used.
- `NOT_VERIFIED` for any interaction or technology that was not exercised.
