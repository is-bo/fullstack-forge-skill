# Build brief: UI

## Decide before coding

- Read DESIGN.md's direction before choosing layout, density, and component patterns; do not default to whatever the last feature looked like without checking it still applies.
- Decide every state this view needs: loading, empty, error, success, permission-denied, and disabled, not only the happy path.
- Decide the responsive behavior: what changes at narrow, medium, and wide viewports, not just that content shrinks.
- Decide what feedback the user gets for every action that takes time or can fail.
- Decide the accessible name, focus order, and keyboard path for every interactive element before wiring events.

## Evidence to produce while building

- A rendered screenshot or interaction trace for each of loading, empty, error, success, permission-denied, and disabled — reading the component source is never proof of visual quality, only of intent.
- A rendered check at narrow and wide viewports showing the layout adapts, not just reflows awkwardly.
- Confirmation every interactive element is reachable and operable by keyboard alone.
- A short note on how this view matches, or deliberately deviates from, DESIGN.md, with the reason.
