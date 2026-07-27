---
name: forge-security
description: Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases. Activate automatically for every production-bound application when that concern is relevant to a software-engineering request.
---

# forge-security: Application security

## Purpose

Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves application security, when
the user explicitly names `forge-security`, or when discovery proves an applicable boundary.

- Every production-bound application
- Security-sensitive changes

## When not to activate

- No exemption; scope may be reduced for non-executable documentation

## Automated support

Relevant discovery inputs are:

- project and architecture profile
- trust boundaries
- dependency and secret scan outputs

Available deterministic support, where present:

- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-auth-boundaries` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-dependencies` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Model the attack surface from discovery: entry points, trust boundaries, secrets, and the assets behind each.
2. Trace untrusted input from every entry point to execution sinks (SQL, shell, template, deserialization, HTTP clients, file paths), recording interpolation versus binding at each sink.
3. Inspect browser-boundary controls: output encoding, CSRF protection, CORS policy, security headers, and cookie flags on the actual responses.
4. Search for secrets in code, configuration, templates, and history; verify error responses and logs do not leak internals or sensitive data.
5. Run available dependency, static, and secret scanners, separating confirmed findings from pattern matches, and check rate limiting and abuse controls on expensive or state-changing operations.

Manual inspection requirements:

- Review business-logic abuse and chained attack paths
- Validate production-only controls with operators

Stack-specific guidance:

- Use framework-native escaping and query parameterization at the final sink

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- OWASP ASVS 5.0
- OWASP Cheat Sheet Series
- NIST SSDF

## Common production failures

- Model assets, actors, entry points, trust boundaries, abuse cases, and mitigations
- Inspect injection, XSS, CSRF, SSRF, deserialization, path handling, redirects, headers, CORS, secrets, logging, and denial-of-service limits
- Run available dependency, static, and secret checks while distinguishing confirmed evidence from pattern matches

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- SQL injection
- NoSQL injection
- OS command injection
- Template injection
- Expression-language injection
- Header injection
- CRLF injection
- Log injection
- CSV and formula injection
- HTML injection
- JavaScript injection
- Cross-site scripting
- CSRF
- SSRF
- Path traversal
- Unsafe redirects
- Unsafe deserialization
- Request smuggling risks
- CORS
- Security headers
- Secret exposure
- Weak cryptography
- Hard-coded credentials
- Sensitive logging
- Error leakage
- Rate limiting
- Denial-of-service exposure
- Business-logic abuse
- Authentication weaknesses
- Authorization weaknesses
- Admin endpoints
- Debug endpoints
- Internal endpoints
- Dependency risks
- Prompt injection
- Unsafe shell execution
- Race conditions
- Mass assignment
- Prototype pollution
- ReDoS
- Session attacks
- OWASP ASVS, OWASP API Security, and NIST SSDF evidence

## Commands and tools

- Run `forge security audit --json` or `fullstack-forge security audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Parameterize known trust-boundary inputs, redact secrets, and add straightforward security headers
- Add allowlists and explicit size limits

## Approval-required changes

- Disabling controls, rotating secrets, or changing authentication, network, or production infrastructure

## Verification

- Re-run scanners and targeted exploit regression tests
- Confirm every PASS has direct evidence

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- This audit is not a penetration test and must not be represented as one
