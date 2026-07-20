# Build brief: Frontend engineering

## Decide before coding

- Decide which parts of this feature render on the server and which on the client, and what crosses that boundary, before writing components that assume the wrong one.
- Decide the loading, cancellation, and stale-response behavior for every new network call, including what happens when a faster later request returns before an earlier one.
- Decide whether any user-controlled content is rendered as HTML; if so, decide the sanitization boundary before it reaches the DOM.
- Decide what happens on hydration mismatch, chunk-load failure, and browsers with lazily loaded code disabled or blocked.
- Decide what must never reach client-side code (secrets, internal identifiers, unredacted internal errors) before wiring the data down to the browser.

## Evidence to produce while building

- A test or trace showing an out-of-order or canceled network response does not overwrite newer state.
- Confirmation that user-controlled content rendered as HTML passes through the sanitization boundary, with the file:line reference.
- A production build exercised for this feature, not only a development server, confirming code-split boundaries and error boundaries behave.
- Confirmation that no secret or unredacted internal detail is present in client-shipped code or network payloads.
