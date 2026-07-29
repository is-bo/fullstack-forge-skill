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
     name: attack-tree-construction
     description: Build comprehensive attack trees to visualize threat paths. Use when mapping attack scenarios, identifying defense gaps, or communicating security risks to stakeholders.
-->
# Attack Tree Construction

Systematic attack path visualization and analysis.

## When to Use This Skill

- Visualizing complex attack scenarios
- Identifying defense gaps and priorities
- Communicating risks to stakeholders
- Planning defensive investments
- Penetration test planning
- Security architecture review

## Core Concepts

### 1. Attack Tree Structure

```
                    [Root Goal]
                         |
            ┌────────────┴────────────┐
            │                         │
       [Sub-goal 1]              [Sub-goal 2]
       (OR node)                 (AND node)
            │                         │
      ┌─────┴─────┐             ┌─────┴─────┐
      │           │             │           │
   [Attack]   [Attack]      [Attack]   [Attack]
    (leaf)     (leaf)        (leaf)     (leaf)
```

### 2. Node Types

| Type     | Symbol    | Description             |
| -------- | --------- | ----------------------- |
| **OR**   | Oval      | Any child achieves goal |
| **AND**  | Rectangle | All children required   |
| **Leaf** | Box       | Atomic attack step      |

### 3. Attack Attributes

| Attribute     | Description             | Values             |
| ------------- | ----------------------- | ------------------ |
| **Cost**      | Resources needed        | $, $$, $$$         |
| **Time**      | Duration to execute     | Hours, Days, Weeks |
| **Skill**     | Expertise required      | Low, Medium, High  |
| **Detection** | Likelihood of detection | Low, Medium, High  |

## Templates and detailed worked examples

Full template library lives in `references/details.md`. Read that file when you need concrete templates for this skill.

## Best Practices

### Do's

- **Start with clear goals** - Define what attacker wants
- **Be exhaustive** - Consider all attack vectors
- **Attribute attacks** - Cost, skill, and detection
- **Update regularly** - New threats emerge
- **Validate with experts** - Red team review

### Don'ts

- **Don't oversimplify** - Real attacks are complex
- **Don't ignore dependencies** - AND nodes matter
- **Don't forget insider threats** - Not all attackers are external
- **Don't skip mitigations** - Trees are for defense planning
- **Don't make it static** - Threat landscape evolves
