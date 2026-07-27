---
name: forge-auth
description: Inspect identity proofing, credentials, sessions, recovery, federation, and reauthentication controls. Activate automatically for applications identifying users, services, or administrators when that concern is relevant to a software-engineering request.
---

# forge-auth: Authentication

Engine: Hybrid — Forge + wshobson, Supabase, Google

## Purpose

Inspect identity proofing, credentials, sessions, recovery, federation, and reauthentication controls.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

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
