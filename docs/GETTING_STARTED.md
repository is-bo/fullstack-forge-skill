# Getting started

## Requirements

- Node.js 20.19+, 22.13+, or 24+
- A Git repository containing an application
- A supported AI coding agent or generic Agent Skills host

## Install in a project

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.1.0"
npx forge init
npx forge doctor
```

Continue working with your AI agent normally. Forge activates automatically for software-engineering
tasks.

Restart or reopen the agent only if it does not refresh newly installed project skills
automatically.

`forge init` detects project and user agent markers, installs the relevant skills, writes managed
automatic-activation instructions, and records ownership in
`.fullstack-forge/install-manifest.json`. Use `forge init all` only when every platform is wanted.
When no supported marker is found, the installer uses the generic `.agents/skills/` host. Multiple
detected hosts are installed together without copying unrelated platform bundles.

## First request

Ask for the product behavior directly:

```text
Add CSV export to the appointments page.
```

The agent should discover the existing implementation, select only relevant playbooks, implement the
feature, consider permissions, query bounds, CSV escaping, UX, and tests, run focused verification,
and report limitations. No Forge command is required.

For example, “Create a mobile-friendly appointment booking flow” automatically composes frontend,
UI, UX, and accessibility guidance, then adds forms, responsive, framework, offline, performance,
i18n, SEO, or security guidance only when the request or repository makes it relevant. Significant
new UI gets a short product and visual-direction decision; a one-component correction stays small.

## Optional explicit use

```text
$forge audit security
$forge frontend audit
$forge ui review
$forge ux review
$forge verify
$forge ship
```

Use explicit commands only to force or narrow a workflow. `$forge` is the Agent Skills form where
supported; slash, mention, and skill-manager forms vary by host. The executable equivalent is
`npx forge audit security`. See [COMMANDS.md](COMMANDS.md) and
[PLATFORM_SUPPORT.md](PLATFORM_SUPPORT.md).

## Update or uninstall

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.1.0"
npx forge update all
npx forge doctor
npx forge uninstall all
```

Updates refuse changed Forge-owned sections and unowned conflicts. Uninstall removes only unchanged
owned content and preserves modified or user-authored instructions.
