# Build brief: Application security

## Decide before coding

- Decide that every input is validated at the final server-side sink, not only in the UI; client-side validation is a convenience, never the control.
- Decide the parameterization or escaping mechanism for any interpolated query, command, template, or path before writing the interpolation.
- Decide the output-encoding context (HTML, attribute, URL, JSON) for any value rendered back to a user or another system, matched to where it actually lands.
- Decide new endpoints and resources start denied by default and are explicitly opened, rather than open by default and restricted later.
- Decide where secrets and credentials for this feature are stored (a secret manager or environment configuration), and confirm none are written into source, logs, or client-shipped code.

## Evidence to produce while building

- A negative test showing an injection attempt (SQL, command, template, or path) is neutralized at the final sink, not just filtered upstream.
- Confirmation that user-controlled output is encoded for the context it is rendered into, with the file:line reference.
- A test showing a request to a newly added endpoint is denied without an explicit grant.
- Confirmation that no secret or credential for this feature appears in source control, logs, or client-visible output.
