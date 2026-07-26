---
name: forge-ai
description: Audit model boundaries, prompt injection, tool authority, data handling, output validation, evaluation, fallback, and cost. Activate automatically for llm, embedding, classifier, agent, retrieval, or generative-media features when that concern is relevant to a software-engineering request.
---

# forge-ai: AI-enabled features

## Purpose

Audit model boundaries, prompt injection, tool authority, data handling, output validation, evaluation, fallback, and cost.

This is an agent playbook, not a claim of standalone analyzer coverage. Apply

`fullstack-forge/references/shared/module-contract.md`

for common applicability, evidence, command-safety, mutation, verification, and completion rules.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves ai-enabled features, when
the user explicitly names `forge-ai`, or when discovery proves an applicable boundary.

- LLM, embedding, classifier, agent, retrieval, or generative-media features

## When not to activate

- No model inference or model-derived decision

## Automated support

Relevant discovery inputs are:

- AI provider inventory
- prompts and tool definitions
- retrieval, evaluation, and moderation code

Available deterministic support, where present:

- Use `scan-secret-patterns` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.
- Use `inspect-routes` for its bounded evidence when present; treat unavailable runtime evidence as `NOT_VERIFIED`.

## Agent inspection procedure

1. Map every model boundary: inputs, system instructions, tools, outputs, and the privileges each tool grants.
2. Trace untrusted content (user text, documents, web, retrieval) into prompts and verify it is isolated as data, not instructions.
3. Verify output handling: schema validation, independent recomputation of identifiers and totals, and no direct path from model output to irreversible actions without deterministic authorization and recorded confirmation.
4. Check tenant isolation of context and retrieval, rate limits, token budgets, cost controls, and logging redaction.
5. Inspect evaluation coverage for injection resistance and task quality, and verify fallback and model-change behavior.

Manual inspection requirements:

- Adversarially test indirect injection and excessive-agency scenarios
- Review high-impact decisions and human oversight

Stack-specific guidance:

- Treat model output and retrieved content as untrusted; enforce controls outside the prompt

## Evidence to collect

For formal findings, also follow `fullstack-forge/references/PROTOCOL.md`. Record the module's
inspected boundary, relevant tests, direct observations, and unavailable evidence.

Primary standards used as criteria, not proof of compliance:

- OWASP LLM Prompt Injection Prevention Cheat Sheet
- OWASP AI Agent Security Cheat Sheet
- NIST AI RMF

## Common production failures

- Map data, instructions, model, retrieval, tools, outputs, users, and trust boundaries
- Inspect prompt injection, instruction/data separation, tool allowlists, per-object authorization, argument validation, confirmation, sandboxing, and output encoding
- Review model/version pinning, privacy, retention, training opt-outs, evaluation sets, hallucination handling, moderation, fallback, rate limits, and cost bounds

## Missing-control checks

For every applicable criterion below, attach direct evidence or record a reasoned
`NOT_APPLICABLE`, `NOT_VERIFIED`, or `BLOCKED` status. The list is a routing checklist, not
evidence by itself.

- Direct prompt injection
- Indirect prompt injection
- Uploaded-document injection
- Web-content injection
- Tool permissions
- Data leakage
- Tenant isolation
- Output-schema validation
- Hallucination-sensitive workflows
- Independent validation
- Human confirmation
- Irreversible actions
- Model fallbacks
- Timeouts
- Rate limits
- Token budgets
- Cost controls
- Logging
- Redaction
- Model-version changes
- Evaluation coverage
- Retrieval poisoning
- Tool-result validation
- Unsafe generated code
- Excessive tool privileges
- Document text treated as hostile data
- Document instructions never overriding system behavior
- Strict structured output
- Independent validation of totals and identifiers
- Restricted tool access
- Human confirmation before stock, accounting, debt, payment, permission, or other irreversible changes
- Original file hash and review history

## Commands and tools

- Run `forge ai audit --json` or `fullstack-forge ai audit --json` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.
- Use the deterministic support named above only for its documented bounded evidence.

## Safe fixes

- Constrain tool schemas, redact sensitive context, and encode output at its sink
- Add deterministic evaluation cases and token limits

## Approval-required changes

- Granting new tool authority, changing model provider, sending new sensitive data, or automating high-impact decisions

## Verification

- Run versioned benign, adversarial, multilingual, and failure evaluation sets
- Confirm unauthorized tool and data requests are denied at execution time

## Completion contract

Apply the shared module contract and the module-specific limitations below.

## Known limitations

- Model behavior is probabilistic; report evaluation scope and residual risk
