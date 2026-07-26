---
name: forge-auth
description: Inspect identity proofing, credentials, sessions, recovery, federation, and reauthentication controls. Activate automatically for applications identifying users, services, or administrators when that concern is relevant to a software-engineering request.
---

# forge-auth: Authentication

## Purpose

Inspect identity proofing, credentials, sessions, recovery, federation, and reauthentication controls.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves authentication, when
the user explicitly names `forge-auth`, or when discovery proves an applicable boundary.

- Applications identifying users, services, or administrators

## When not to activate

- Truly anonymous static content with no privileged operation

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

- authentication provider and middleware
- session configuration
- account routes

Available deterministic support, where present:

- Use `inspect-auth-boundaries` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Trace registration, login, and logout end to end, recording where credentials are validated, hashed, and stored.
3. Inspect session issuance: how identifiers are generated, what the cookie or token carries, its flags, lifetime, and revocation path.
4. Trace password reset and recovery flows for token entropy, expiry, single-use enforcement, and account-enumeration behavior.
5. Check brute-force protections, MFA enrollment and verification, and reauthentication for sensitive actions.
6. Verify session-fixation defense (rotation at login), remember-me behavior, and device/session management against the session store.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review provider tenant settings and recovery support procedures
- Test session revocation and high-risk reauthentication

Stack-specific guidance:

- Validate framework middleware order and provider defaults explicitly

## Evidence to collect

- Cite repository-relative files and 1-based lines for source evidence.
- Record exact commands, exit codes, relevant output summaries, and execution time.
- Record URL, viewport, role, input method, and observed state for running-interface evidence.
- Name each test and demonstrate that it exercises the claimed behavior.
- Use `NOT_VERIFIED` for unavailable production, provider, browser, database, or operator evidence.
- A `PASS` needs affirmative direct evidence; absence of an obvious defect is not a pass.
- Agent findings use a supported producer, evidence type, explanation, safe-fix classification,
  revision, commands executed, and remaining limitations.

Primary standards used as criteria, not proof of compliance:

- OWASP ASVS 5.0
- OWASP Authentication Cheat Sheet
- NIST SP 800-63B

## Common production failures

- Trace sign-up, sign-in, logout, recovery, verification, MFA, reauthentication, and account linking
- Inspect password hashing, session rotation, expiry, cookie flags, CSRF, token audience/issuer/algorithm, enumeration, and brute-force defenses
- Verify state-changing endpoints derive identity from trusted server context

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

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
- Use `inspect-auth-boundaries` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Harden cookie flags and redact authentication errors
- Add missing token claim validation supported by current configuration

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Replacing authentication, changing identity linkage, or rotating credentials

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Run positive and negative flows with expired, replayed, tampered, and cross-environment credentials
- Confirm logout and revocation invalidate durable sessions

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain `NOT_VERIFIED` or `BLOCKED`; never convert it to `PASS` based on intent.

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- Hosted-provider settings remain NOT_VERIFIED without exported configuration

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
