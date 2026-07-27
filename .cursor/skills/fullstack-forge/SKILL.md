---
name: fullstack-forge
description:
  "Use Fullstack Forge automatically whenever working on a full-stack application or making a
  software-engineering change in a repository where it is installed. It guides the agent through
  production-ready architecture, security, data, APIs, UI, testing, reliability, performance, and
  release practices. The user does not need to invoke Forge explicitly. Trigger for build, create,
  implement, add a feature, change behaviour, fix, debug, refactor, optimise, migrate, review,
  audit, test, verify, deploy, release, or ship requests. Use explicit Forge commands only when the
  user requests a specific workflow or audit area; do not activate for unrelated writing or general
  conversation."
---

<!-- fullstack-forge:managed-adapter v1 skill=fullstack-forge canonical=../../../.fullstack-forge/skills/fullstack-forge/SKILL.md -->

# Fullstack Forge adapter: fullstack-forge

This file is a pointer maintained by Fullstack Forge. It exists so this agent host can
discover and trigger the skill. The full playbook is not duplicated here: one canonical copy
is shared by every installed host.

**Read the canonical playbook now and follow it exactly:**

`../../../.fullstack-forge/skills/fullstack-forge/SKILL.md`

That path is relative to this file. From the installation root it is
`.fullstack-forge/skills/fullstack-forge/SKILL.md`. Every resource the playbook references
(`fullstack-forge/references/...`, `fullstack-forge/schemas/...`,
`fullstack-forge/templates/...`, `fullstack-forge/profiles/...`) resolves relative to
`.fullstack-forge/skills/`.

Do not edit this adapter; edit the canonical playbook instead. If the canonical file is
missing or unreadable the installation is damaged: run `forge doctor`, then `forge update all`.
