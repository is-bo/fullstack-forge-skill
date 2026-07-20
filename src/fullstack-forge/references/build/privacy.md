# Build brief: Privacy

## Decide before coding

- Decide the specific purpose for every new personal-data field before collecting it; if there is no stated purpose, do not collect it.
- Decide the retention period and deletion path for this data now, including what happens to it on account or tenant deletion.
- Decide which fields are sensitive enough to exclude from logs, analytics, and error reporting before instrumentation is added.
- Decide the legal basis or consent requirement for this data before it is collected, for anything beyond what is strictly necessary to operate the feature.
- Decide how this data is included (or explicitly excluded) from data export and deletion requests before those code paths are written.

## Evidence to produce while building

- A short data-inventory note: field, purpose, retention, and deletion path for any new personal data.
- Confirmation that sensitive fields are absent from logs, analytics events, and error reports for this feature.
- A test showing account or tenant deletion removes or anonymizes this data as decided.
- Confirmation that export and deletion requests correctly include this new data.
