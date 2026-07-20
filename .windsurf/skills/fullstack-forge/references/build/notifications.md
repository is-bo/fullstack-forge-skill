# Build brief: Notifications

## Decide before coding

- Decide the authorization check confirming the recipient is entitled to receive this notification before the send path is wired.
- Decide the deduplication or idempotency key for this notification so a retry or duplicate trigger does not send it twice.
- Decide how this notification respects user preferences and required opt-outs, and which notifications (if any) are mandatory regardless of preference.
- Decide the sensitive-content boundary for what appears in a preview, push payload, or subject line versus what requires opening the app to see.
- Decide the retry and expiry behavior for this notification so a stale send is not delivered long after it stopped being relevant.

## Evidence to produce while building

- A test confirming the recipient's authorization and current preference are checked before send.
- A test showing a duplicate trigger for the same event produces exactly one delivered notification.
- Confirmation that sensitive content is excluded from preview or push payloads where it should be.
- A test showing an expired or superseded notification is not delivered late.
