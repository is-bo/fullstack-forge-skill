---
name: forge-auth
description: "Inspect identity proofing, credentials, sessions, recovery, federation, and reauthentication controls."
---

# forge-auth: Authentication

Engine: Hybrid — Forge + wshobson, Supabase, Google

## Purpose

Inspect identity proofing, credentials, sessions, recovery, federation, and reauthentication controls.


## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve `../../runtime/cli/src/composition-entry.js` relative to this `SKILL.md`, then run:

`node "<resolved-absolute-runner-path>" auth compose --workflow audit --root "<repository-root>" --dry-run --json`

Add one repeatable `--request <provider-or-source>` flag for each explicit user request. Add
`--condition <task-condition>` or `--risk-surface <surface>` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use `--workflow build`, and for a fix, retest, or
release gate use `--workflow fix`, `verify`, or `ship` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute `runtime_root`
reported in that response. Read `eager[].runtimePath` when entering the module. The full
`selected[]` list is availability/provenance; load only `deferred[].runtimePath` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If `missing` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.


Resolve and read `../fullstack-forge/references/shared/module-contract.md` (applicability,
execution, mutation, verification, completion) and
`../fullstack-forge/references/shared/evidence-rules.md` (statuses, standards, tools, findings via
`../fullstack-forge/references/PROTOCOL.md`) relative to this module `SKILL.md` before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves authentication, when
the user explicitly names `forge-auth`, or when discovery proves an applicable boundary.

- Applications identifying users, services, or administrators

## When not to activate

- Truly anonymous static content with no privileged operation

## Automated support

Relevant discovery inputs are:

- authentication provider and middleware
- session configuration
- account routes

Deterministic support, bounded evidence only:

- `inspect-auth-boundaries`

## Agent inspection procedure

1. Trace registration, login, and logout end to end, recording where credentials are validated, hashed, and stored.
2. Inspect session issuance: how identifiers are generated, what the cookie or token carries, its flags, lifetime, and revocation path.
3. Trace password reset and recovery flows for token entropy, expiry, single-use enforcement, and account-enumeration behavior.
4. Check brute-force protections, MFA enrollment and verification, and reauthentication for sensitive actions.
5. Verify session-fixation defense (rotation at login), remember-me behavior, and device/session management against the session store.

Manual inspection requirements:

- Review provider tenant settings and recovery support procedures
- Test session revocation and high-risk reauthentication

Stack-specific guidance:

- Validate framework middleware order and provider defaults explicitly

## Evidence to collect

Standards used as criteria:

- OWASP ASVS 5.0
- OWASP Authentication Cheat Sheet
- NIST SP 800-63B

## Common production failures

- Trace sign-up, sign-in, logout, recovery, verification, MFA, reauthentication, and account linking
- Inspect password hashing, session rotation, expiry, cookie flags, CSRF, token audience/issuer/algorithm, enumeration, and brute-force defenses
- Verify state-changing endpoints derive identity from trusted server context

## Missing-control checks

Each item needs direct evidence or one reasoned status.

- Registration
- Login
- Password hashing
- Password policies
- Password reset
- Email verification
- MFA
- Sessions
- Expiration
- Revocation
- Secure cookies
- Refresh-token rotation
- OAuth configuration
- OIDC configuration
- Account enumeration
- Brute-force protections
- Rate limits
- Remember-me behavior
- Logout
- Device and session management
- Sensitive-action reauthentication
- Session fixation
- Token leakage
- Recovery flows
- Maintained password, session, and identity libraries rather than custom cryptography

## Commands and tools

- Run `forge auth audit --json` or `fullstack-forge auth audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

- Harden cookie flags and redact authentication errors
- Add missing token claim validation supported by current configuration

## Approval-required changes

- Replacing authentication, changing identity linkage, or rotating credentials

## Verification

- Run positive and negative flows with expired, replayed, tampered, and cross-environment credentials
- Confirm logout and revocation invalidate durable sessions

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- Hosted-provider settings remain NOT_VERIFIED without exported configuration
