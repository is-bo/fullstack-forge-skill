---
name: forge-security
description: Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases. Activate automatically for every production-bound application when that concern is relevant to a software-engineering request.
---

# forge-security: Application security

## Purpose

Perform a threat-informed audit of trust boundaries, injection, secrets, browser controls, dependencies, and abuse cases.

This is an agent playbook, not a claim of standalone analyzer coverage. The agent supplies reasoning
and implementation; deterministic CLI support is used only where named below.

## Automatic activation signals

Activate when a request or direct repository evidence involves application security, when
the user explicitly names `forge-security`, or when discovery proves an applicable boundary.

- Every production-bound application
- Security-sensitive changes

## When not to activate

- No exemption; scope may be reduced for non-executable documentation

Do not activate from generated Forge files, examples, fixtures, or a dependency name alone. Record
`NOT_APPLICABLE` only when a requested audit requires an explicit applicability decision.

## Automated support

Support four explicit modes: `audit`, `fix`, `verify`, and `report`. Automatic feature work
uses the same guidance without requiring a Forge command. Relevant discovery inputs are:

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

1. Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it.
2. Model the attack surface from discovery: entry points, trust boundaries, secrets, and the assets behind each.
3. Trace untrusted input from every entry point to execution sinks (SQL, shell, template, deserialization, HTTP clients, file paths), recording interpolation versus binding at each sink.
4. Inspect browser-boundary controls: output encoding, CSRF protection, CORS policy, security headers, and cookie flags on the actual responses.
5. Search for secrets in code, configuration, templates, and history; verify error responses and logs do not leak internals or sensitive data.
6. Run available dependency, static, and secret scanners, separating confirmed findings from pattern matches, and check rate limiting and abuse controls on expensive or state-changing operations.
7. Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.
8. Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence.

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

Manual inspection requirements:

- Review business-logic abuse and chained attack paths
- Validate production-only controls with operators

Stack-specific guidance:

- Use framework-native escaping and query parameterization at the final sink

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
- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-auth-boundaries` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-authorization` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-dependencies` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Safe fixes

- Parameterize known trust-boundary inputs, redact secrets, and add straightforward security headers
- Add allowlists and explicit size limits

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden `--safe` into an architectural or policy decision.

## Approval-required changes

- Disabling controls, rotating secrets, or changing authentication, network, or production infrastructure

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification

- Re-run scanners and targeted exploit regression tests
- Confirm every PASS has direct evidence

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

- This audit is not a penetration test and must not be represented as one

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
