# Getting started

## Requirements

- Node.js 24 or newer
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

`forge init` detects project and user agent markers, installs the relevant skills, writes managed
automatic-activation instructions, and records ownership in
`.fullstack-forge/install-manifest.json`. Use `forge init all` only when every platform is wanted.

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

Use explicit commands to force an audit area or gate. See [COMMANDS.md](COMMANDS.md).

## Update or uninstall

```bash
npm install --save-dev "git+https://github.com/is-bo/fullstack-forge-skill.git#v0.1.0"
npx forge update all
npx forge doctor
npx forge uninstall all
```

Updates refuse changed Forge-owned sections and unowned conflicts. Uninstall removes only unchanged
owned content and preserves modified or user-authored instructions.
