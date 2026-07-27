# Build brief: Realtime communication

## Decide before coding

- Decide the authorization check for every subscribe, publish, and channel action, not only at initial connection; a valid connection is not a blanket grant.
- Decide how an expired or revoked credential terminates or blocks an already-open connection, not only new ones.
- Decide the message schema and size bound for this channel before accepting arbitrary payloads from a connected client.
- Decide the tenant or scope namespace for channels so one tenant's messages cannot reach another's connection.
- Decide the reconnect and resume behavior (ordering, deduplication, cursor) so a dropped connection does not lose or duplicate messages on resume.

## Evidence to produce while building

- A test showing a subscribe or publish attempt without the required authorization is rejected, even on an open connection.
- A test showing a revoked or expired credential causes an already-open connection to be terminated or blocked.
- Confirmation that channels are namespaced by tenant, with a cross-tenant subscribe attempt rejected.
- A test covering abrupt disconnect and reconnect, confirming no duplicated or lost messages on resume.
