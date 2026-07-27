# Interface anti-patterns

Owner: the frontend orchestrator routes each confirmed issue to its specialist module.

## Load when

- Reviewing substantial new work, redesigns, inconsistent interfaces, or final release candidates.

## Do not load when

- The task is a small bounded correction and none of these patterns is implicated.

## Visual sameness without product intent

- Generic gradients, translucent surfaces, universal cards, excessive radii, and oversized heroes:
  remove the device when it has no product rationale; rebuild hierarchy from content, type, spacing,
  density, and task priority.
- Random icons, mixed icon families, scattered literal colors, and inconsistent spacing: reuse the
  established semantic system; add a token only for a repeated role.
- Placeholder copy, invented testimonials, or fake metrics: use truthful representative content and
  visibly mark fixtures. Never fabricate credibility signals.
- Excessive centered text or decorative motion: align to the reading and task structure; keep motion
  only when it communicates state, causality, feedback, or continuity.

## Interaction and state debt

- Inaccessible custom controls or removed focus indicators: replace with native semantics or
  implement and verify the complete interaction pattern.
- Icon-only actions with unclear meaning: provide a persistent accessible name and visible text when
  recognition is not reliably established.
- Loading spinners everywhere: represent the actual wait, preserve layout, and allow useful existing
  content to remain visible when it is not invalidated.
- Empty states with no next action, errors with no recovery, or destructive actions with no escape:
  explain the state, preserve user work, and expose the next safe step.
- Desktop-only tables: preserve comparison and exact values through a deliberate narrow-screen
  model.

## Implementation debt

- Duplicated components or enormous client components: restore one behavioral owner and split only
  at meaningful responsibility or delivery boundaries.
- Effects used to derive state, repeated data fetching, and missing cancellation: derive locally
  when possible and define request ownership, races, and cleanup.
- Unnecessary dependencies: prove the existing stack cannot satisfy the need and record bundle,
  maintenance, security, and migration cost before adding one.
- Unrequested design-system rewrites: make the smallest coherent extension and preserve unrelated
  screens, public APIs, and stable dependencies.
- Copying a reference too closely: adapt concepts to the product, content, brand, platform, and
  accessibility requirements; do not recreate another product’s visual identity.

## Review rule

An anti-pattern is a diagnostic prompt, not proof. Report it only after direct evidence shows user,
maintenance, accessibility, correctness, or performance impact. Optional polish must remain
optional.
