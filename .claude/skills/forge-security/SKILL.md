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

Follow the installed bundle's `fullstack-forge/references/PROTOCOL.md` only when this module is
auditing, verifying, or producing formal findings. For this module specifically:

- Cite the module's inspected source, configuration, runtime boundary, and relevant tests.
- Capture exact project commands and direct runtime observations that support the claimed status.
- Record module-specific limitations from unavailable providers, environments, roles, or tools.

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

Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`. An explicit finding
remediation also loads `fullstack-forge/references/workflows/fix.md`.

## Approval-required changes

- Disabling controls, rotating secrets, or changing authentication, network, or production infrastructure

The canonical safe-fix policy owns cross-module approval boundaries; these bullets add only this
module's specialist decisions.

## Verification

- Re-run scanners and targeted exploit regression tests
- Confirm every PASS has direct evidence

For finding retests, load `fullstack-forge/references/workflows/verify.md`. Preserve the original
observation and append current module-specific evidence.

## Completion contract

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Follow
`fullstack-forge/references/shared/completion.md`; conditions outside the affected boundary remain
outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never `PASS`.

Never hide failed checks or claim that an operation ran when it did not.

## Known limitations

- This audit is not a penetration test and must not be represented as one

The module guides agent reasoning and uses deterministic automation where supported. It cannot by
itself prove production, provider, human-policy, or unsupported framework behavior.
