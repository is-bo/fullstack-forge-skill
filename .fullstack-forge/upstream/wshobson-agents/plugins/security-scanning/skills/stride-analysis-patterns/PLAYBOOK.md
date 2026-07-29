<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

<!-- fullstack-forge:upstream-reference provider=wshobson-agents -->

> **Fullstack Forge managed reference.** This is vendored upstream expertise, compiled into
> Forge's managed tree. It is not an independently installable skill and no agent host can
> discover or trigger it: Forge's composition engine decides when it applies. Forge's module
> contract, evidence rules, and status semantics take precedence over anything written here.

<!-- upstream activation metadata, preserved for provenance and deliberately inert:
     name: stride-analysis-patterns
     description: Apply STRIDE methodology to systematically identify threats. Use when analyzing system security, conducting threat modeling sessions, or creating security documentation.
-->
# STRIDE Analysis Patterns

Systematic threat identification using the STRIDE methodology.

## When to Use This Skill

- Starting new threat modeling sessions
- Analyzing existing system architecture
- Reviewing security design decisions
- Creating threat documentation
- Training teams on threat identification
- Compliance and audit preparation

## Core Concepts

### 1. STRIDE Categories

```
S - Spoofing       → Authentication threats
T - Tampering      → Integrity threats
R - Repudiation    → Non-repudiation threats
I - Information    → Confidentiality threats
    Disclosure
D - Denial of      → Availability threats
    Service
E - Elevation of   → Authorization threats
    Privilege
```

### 2. Threat Analysis Matrix

| Category            | Question                                  | Control Family |
| ------------------- | ----------------------------------------- | -------------- |
| **Spoofing**        | Can attacker pretend to be someone else?  | Authentication |
| **Tampering**       | Can attacker modify data in transit/rest? | Integrity      |
| **Repudiation**     | Can attacker deny actions?                | Logging/Audit  |
| **Info Disclosure** | Can attacker access unauthorized data?    | Encryption     |
| **DoS**             | Can attacker disrupt availability?        | Rate limiting  |
| **Elevation**       | Can attacker gain higher privileges?      | Authorization  |

## Templates and detailed worked examples

Full template library lives in `references/details.md`. Read that file when you need concrete templates for this skill.

## Best Practices

### Do's

- **Involve stakeholders** - Security, dev, and ops perspectives
- **Be systematic** - Cover all STRIDE categories
- **Prioritize realistically** - Focus on high-impact threats
- **Update regularly** - Threat models are living documents
- **Use visual aids** - DFDs help communication

### Don'ts

- **Don't skip categories** - Each reveals different threats
- **Don't assume security** - Question every component
- **Don't work in isolation** - Collaborative modeling is better
- **Don't ignore low-probability** - High-impact threats matter
- **Don't stop at identification** - Follow through with mitigations
