# Build brief: Authentication

## Decide before coding

- Decide to use an established authentication library or provider for credentials, sessions, and tokens; never write custom password hashing, token signing, or session logic.
- Decide session lifetime, rotation, and revocation behavior (including logout, password change, and forced sign-out) before sessions are issued.
- Decide cookie flags (HttpOnly, Secure, SameSite) and storage location for any session or token before the first sign-in path is written.
- Decide the response behavior for invalid credentials, unknown accounts, and locked accounts so none of them lets an attacker distinguish valid from invalid usernames.
- Decide the rate limit or lockout behavior for authentication attempts before the login endpoint is reachable.

## Evidence to produce while building

- Confirmation that password, token, and session handling comes from a maintained library or provider, not custom cryptography.
- A test showing logout or revocation actually invalidates the session server-side, not just client-side.
- A test showing invalid-credential and unknown-account responses are indistinguishable (no username enumeration).
- A test showing repeated failed login attempts are rate-limited or locked out.
- Confirmation that session cookies carry the intended HttpOnly, Secure, and SameSite flags in the actual response.
