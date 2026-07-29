---
name: forge-tenancy
description: Verify tenant context propagation and isolation across data, cache, files, jobs, search, analytics, and administration. Activate automatically for shared applications serving distinct organizations or customer partitions when that concern is relevant to a software-engineering request.
---

<!-- fullstack-forge:managed-adapter v1 skill=forge-tenancy canonical=../../../.fullstack-forge/skills/forge-tenancy/SKILL.md -->

# Fullstack Forge adapter: forge-tenancy

This file is a pointer maintained by Fullstack Forge. It exists so this agent host can
discover and trigger the skill. The full playbook is not duplicated here: one canonical copy
is shared by every installed host.

**Read the canonical playbook now and follow it exactly:**

`../../../.fullstack-forge/skills/forge-tenancy/SKILL.md`

That path is relative to this file. From the installation root it is
`.fullstack-forge/skills/forge-tenancy/SKILL.md`. Every resource the playbook references
(`fullstack-forge/references/...`, `fullstack-forge/schemas/...`,
`fullstack-forge/templates/...`, `fullstack-forge/profiles/...`) resolves relative to
`.fullstack-forge/skills/`.

**Resolve the runtime composition before loading specialist guidance:**

`node ../../../.fullstack-forge/runtime/cli/src/composition-entry.js tenancy compose --root <repository-root> --json`

Pass repeatable `--request`, `--condition`, or `--risk-surface` values only for
explicit requests and directly proven task facts.

Then load only the ordered `selected` paths in `.forge/composition.json`. Stop and
report the installation as damaged if `missing` is non-empty; suppressed sources are not
fallback instructions.

Do not edit this adapter; edit the canonical playbook instead. If the canonical file is
missing or unreadable the installation is damaged: run `forge doctor`, then `forge update all`.
