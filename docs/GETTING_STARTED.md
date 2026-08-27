# Getting started

## Requirements

- Node.js 20.19+, 22.13+, or 24+
- A Git repository containing an application
- A supported AI coding agent or generic Agent Skills host

## Install in a project

Install the current downloadable `v0.3.0` release from its immutable GitHub asset:

```bash
npm install --save-dev "https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.0/fullstack-forge-skill-v0.3.0.tgz"
# NOT YET AVAILABLE until the v0.3.0 GitHub Release is published.
npx --no-install forge init
npx --no-install forge doctor
```

You can also ask your AI agent to do this by sending:

```bash
Install Fullstack Forge from this exact release URL:
https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.0/fullstack-forge-skill-v0.3.0.tgz
# NOT YET AVAILABLE until the v0.3.0 GitHub Release is published.
Install it as a development dependency, run `npx --no-install forge init`, then run
`npx --no-install forge doctor`. Do not substitute another package or an unpinned npx command.
Report the installed version and any verification failure.
```

For an existing installation, update using the same exact release package:

```bash
npm install --save-dev "https://github.com/is-bo/fullstack-forge-skill/releases/download/v0.3.0/fullstack-forge-skill-v0.3.0.tgz"
# NOT YET AVAILABLE until the v0.3.0 GitHub Release is published.
npx --no-install forge update all
npx --no-install forge doctor
```

The historical v0.2.0 and v0.2.1 tags were never published as GitHub Releases and are not supported
installation targets.

Continue working with your AI agent normally. Forge activates automatically for software-engineering
tasks.

Restart or reopen the agent only if it does not refresh newly installed project skills
automatically.

`forge init` detects project and user agent markers, installs the relevant skills, writes managed
automatic-activation instructions, and records ownership in
`.fullstack-forge/install-manifest.json`. Use `forge init all` only when every platform is wanted.
When no supported marker is found, the installer uses the generic `.agents/skills/` host. Multiple
detected hosts are installed together without copying unrelated platform bundles.

## Codex plugin distribution

The repository marketplace entry is version-pinned to `fullstack-forge-skill@0.3.0` and its install
policy is `NOT_AVAILABLE` because that npm package is not published. Publishing the GitHub Release
does not publish it. Only after npm publication is independently observed, its artifact is verified,
and the marketplace policy becomes `AVAILABLE` should you register the marketplace and install the
plugin:

```bash
codex plugin marketplace add https://github.com/is-bo/fullstack-forge-skill
codex plugin add fullstack-forge@fullstack-forge
```

Plugin installation does not add the Forge CLI to the target project. Use the installed Codex skills
directly. For terminal automation, separately install the exact release package in that project and
run `npx --no-install forge ...`; do not run bare `npx forge` from a plugin-only project, because
npm can resolve a different public package with that name.

Refresh or remove the plugin explicitly:

```bash
codex plugin marketplace upgrade fullstack-forge
codex plugin remove fullstack-forge@fullstack-forge
codex plugin add fullstack-forge@fullstack-forge

# Complete removal
codex plugin remove fullstack-forge@fullstack-forge
codex plugin marketplace remove fullstack-forge
```

The plugin manifest points at the package's generated `skills/` thin adapters. Those adapters and
the generic `.agents/skills/` host adapters both point at the one canonical
`.fullstack-forge/skills/` playbook tree; no full playbook copy is added. Check
`npm view fullstack-forge-skill@0.3.0 version` before installing. Until npm publication and catalog
activation are verified, use the project installation above.

## Optional external experts

You may explicitly provide separately installed expert packs as user-managed advisory context. They
are not part of the Forge package, do not gain automatic activation, and cannot override Forge's
evidence, precedence, approval, or Ship contracts. See [EXTERNAL_EXPERTS.md](EXTERNAL_EXPERTS.md).

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
`npx --no-install forge audit security`. See [COMMANDS.md](COMMANDS.md) and
[PLATFORM_SUPPORT.md](PLATFORM_SUPPORT.md).

## Update or uninstall

```bash
npm install --save-dev "https://codeload.github.com/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v0.2.2"
npx --no-install forge update all
npx --no-install forge doctor
npx --no-install forge uninstall all
```

After v0.3.0 is published, replace the first command with the exact v0.3.0 release-package command
shown above.

Updates refuse changed Forge-owned sections and unowned conflicts. Uninstall removes only unchanged
owned content and preserves modified or user-authored instructions.
