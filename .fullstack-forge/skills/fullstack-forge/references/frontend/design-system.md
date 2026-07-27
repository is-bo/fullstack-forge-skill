# Design-system integration

Owner: `forge-ui`. Component mechanics belong to `component-architecture`; semantic accessibility
belongs to `forge-accessibility`.

## Load when

- Creating or extending tokens, themes, shared primitives, variants, or repeated interface patterns.
- A review finds confirmed visual drift across multiple locations.

## Do not load when

- One local change can reuse existing tokens and components without changing the system.
- The repository has no interface.

## Inspect before extending

Find the current token source, theme mapping, component library, styling mechanism, icon set, and
nearest comparable component. Prefer the established primitive and variant API. Do not introduce a
parallel library, token vocabulary, or theme provider because one screen is inconvenient.

Define semantic roles before literal values: surfaces, text emphasis, borders, focus, actions,
status, spacing rhythm, type roles, radius levels, elevation, layout widths, breakpoints, motion,
and data-series colors. Map light and dark themes independently and verify contrast in both.

## Extend proportionately

- Add a token only when it expresses a reusable decision, not an isolated number.
- Keep variants explicit; avoid a matrix of unrelated booleans.
- Document component states: default, hover or press, focus, disabled, loading, error, and selected.
- Preserve source ownership and library composition conventions.
- Treat charts and brand assets as consumers of the system, not reasons to hard-code exceptions.

Example: add `surface-danger-subtle` only if several destructive contexts need the same semantic
role. A single red notice can use the nearest existing status token.

## Evidence

- Token and component source paths plus the precedent reused.
- Search evidence that a new primitive or token did not already exist.
- Rendered comparison across relevant themes and states.
- Migration scope and approval if changing public component APIs or the product’s visual language.
