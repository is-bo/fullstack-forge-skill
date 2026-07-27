# Build brief: Accessibility

## Decide before coding

- Decide the accessible name, role, and keyboard interaction for every custom interactive element before wiring events, using a native HTML control instead when one already does the job.
- Decide the focus behavior for this flow: initial focus, order, visible focus style, and where focus goes after a dialog closes or content changes.
- Decide how errors and dynamic status changes are announced to assistive technology, not only shown visually.
- Check color and state are never the only signal (contrast, icon-only actions, error highlighting) before finalizing the visual design.
- Treat an automated accessibility scan as a floor, not the audit: decide which keyboard and screen-reader walkthroughs this flow still needs.

## Evidence to produce while building

- A keyboard-only walkthrough of the complete flow, confirming every interactive element is reachable and operable.
- Confirmation that dynamic errors and status updates are exposed to assistive technology, with the mechanism named.
- An automated scan result plus the manual checks it cannot cover (focus order, reading order, meaningful announcements).
- A contrast and target-size check for new or changed interactive elements, mapped to the specific WCAG 2.2 AA success criterion.
