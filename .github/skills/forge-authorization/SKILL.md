---
name: forge-authorization
description: "Verify deny-by-default function, object, role, tenant, and administrative authorization on every path."
---

<!-- fullstack-forge:managed-adapter v1 skill=forge-authorization canonical=../../../.fullstack-forge/skills/forge-authorization/SKILL.md -->

# Fullstack Forge adapter: forge-authorization

This file is a pointer maintained by Fullstack Forge. It exists so this agent host can
discover and trigger the skill. The full playbook is not duplicated here: one canonical copy
is shared by every installed host.

**Read the canonical playbook now and follow it exactly:**

`../../../.fullstack-forge/skills/forge-authorization/SKILL.md`

That path is relative to this file. From the installation root it is
`.fullstack-forge/skills/forge-authorization/SKILL.md`. Every resource the playbook references
(`fullstack-forge/references/...`, `fullstack-forge/schemas/...`,
`fullstack-forge/templates/...`, `fullstack-forge/profiles/...`) resolves relative to
`.fullstack-forge/skills/`.
The canonical playbook owns any deterministic composition step; perform that step exactly
once. This adapter never adds a second workflow or composition command.

Do not edit this adapter; edit the canonical playbook instead. If the canonical file is
missing or unreadable the installation is damaged. Report it and repair through the same
project-package, archive, or plugin mechanism that installed this adapter. Never fall back to
an unpinned `npx forge`, which may resolve an unrelated public package.
