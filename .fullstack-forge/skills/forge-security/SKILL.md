---
name: forge-security
description: Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases. Activate automatically for every production-bound application when that concern is relevant to a software-engineering request.
---

# forge-security: Application security

Engine: Hybrid — Forge + Addy Osmani Agent Skills, Google

## Purpose

Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases.

Read `fullstack-forge/references/shared/module-contract.md` (applicability, execution, mutation,
verification, completion) and `fullstack-forge/references/shared/evidence-rules.md` (statuses,
standards, tools, findings via `fullstack-forge/references/PROTOCOL.md`) before reporting.

Specialist expertise for this module is composed by Forge, not announced by an upstream skill.
Read `fullstack-forge/references/shared/composition-precedence.md` for the load order and the
conflict rules, and `.fullstack-forge/manifests/module-composition.json` for what this module
loads and under what evidence.

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

Deterministic support, bounded evidence only:

- `scan-secret-patterns`
- `inspect-routes`
- `inspect-auth-boundaries`
- `inspect-authorization`
- `inspect-dependencies`

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

Standards used as criteria:

- OWASP ASVS 5.0
- OWASP Cheat Sheet Series
- NIST SSDF

## Common production failures

- Model assets, actors, entry points, trust boundaries, abuse cases, and mitigations
- Inspect injection, XSS, CSRF, SSRF, deserialization, path handling, redirects, headers, CORS, secrets, logging, and denial-of-service limits
- Run available dependency, static, and secret checks while distinguishing confirmed evidence from pattern matches

## Missing-control checks

Each item needs direct evidence or one reasoned status.

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

## Safe fixes

- Parameterize known trust-boundary inputs, redact secrets, and add straightforward security headers
- Add allowlists and explicit size limits

## Approval-required changes

- Disabling controls, rotating secrets, or changing authentication, network, or production infrastructure

## Verification

- Re-run scanners and targeted exploit regression tests
- Confirm every PASS has direct evidence

## Completion contract

Follow `fullstack-forge/references/shared/completion.md` and the limitations below.

## Known limitations

- This audit is not a penetration test and must not be represented as one
