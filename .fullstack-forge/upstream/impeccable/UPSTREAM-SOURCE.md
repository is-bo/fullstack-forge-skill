# Impeccable

Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is
a pristine copy of the selected upstream files: Forge never edits it in place. Runtime
adaptations are applied by the composition compiler from declared overlays and transforms.

| Field | Value |
| --- | --- |
| Repository | `pbakaus/impeccable` |
| Upstream commit | `fc2e694afca1ac0cc384b4fe56bab3335fea7912` |
| Upstream tag | `skill-v4.0.2` |
| Licence | Apache-2.0 |
| Licence evidence | `LICENSE` |
| Files imported | 54 |
| Content checksum | `11c6df11f95d2e8f2749560979129df5a4c0847602668191bb3ef0c0f737e237` |
| Update policy | reviewed-only |

## Selected paths

- `.claude/skills/impeccable/SKILL.md`
- `.claude/skills/impeccable/reference/`
- `.claude/skills/impeccable/scripts/command-metadata.json`
- `.claude/skills/impeccable/scripts/detector/`
- `.claude/skills/impeccable/scripts/lib/impeccable-config.mjs`
- `LICENSE`
- `NOTICE.md`

## Excluded paths

- `.claude/skills/impeccable/reference/doctor.md`
- `.claude/skills/impeccable/reference/hooks.md`
- `.claude/skills/impeccable/scripts/detector/browser/`
- `.claude/skills/impeccable/scripts/detector/detect-antipatterns-browser.js`
- `.claude/skills/impeccable/scripts/detector/detect-antipatterns.mjs`

## Declared runtime executables

These files are executable code. They are allowlisted here, and Forge runs them only through
an explicit adapter with an explicit approval boundary — never because a module was loaded.

- `.claude/skills/impeccable/scripts/detector/cli/main.mjs`
- `.claude/skills/impeccable/scripts/detector/design-system.mjs`
- `.claude/skills/impeccable/scripts/detector/engines/browser/detect-url.mjs`
- `.claude/skills/impeccable/scripts/detector/engines/regex/detect-text.mjs`
- `.claude/skills/impeccable/scripts/detector/engines/static-html/css-cascade.mjs`
- `.claude/skills/impeccable/scripts/detector/engines/static-html/detect-html.mjs`
- `.claude/skills/impeccable/scripts/detector/engines/visual/screenshot-contrast.mjs`
- `.claude/skills/impeccable/scripts/detector/findings.mjs`
- `.claude/skills/impeccable/scripts/detector/node/file-system.mjs`
- `.claude/skills/impeccable/scripts/detector/profile/profiler.mjs`
- `.claude/skills/impeccable/scripts/detector/registry/antipatterns.mjs`
- `.claude/skills/impeccable/scripts/detector/rules/checks.mjs`
- `.claude/skills/impeccable/scripts/detector/shared/color.mjs`
- `.claude/skills/impeccable/scripts/detector/shared/constants.mjs`
- `.claude/skills/impeccable/scripts/detector/shared/fonts.mjs`
- `.claude/skills/impeccable/scripts/detector/shared/inline-ignores.mjs`
- `.claude/skills/impeccable/scripts/detector/shared/page.mjs`
- `.claude/skills/impeccable/scripts/lib/impeccable-config.mjs`

## Import notes

The detector import closure is vendored whole so the module graph resolves offline; the 350 KiB pre-bundled browser detector and the browser-injection payload are excluded because Forge only ever runs the detector against local files. `forge ui live` ships guidance only: the interactive live server, hook system, and screenshot runtime are deliberately not imported. The hook and doctor reference documents are excluded with the subsystems they describe: Forge does not vendor the hook system, and `forge doctor` owns installation health, so shipping guidance for either would advertise a workflow that does not exist.

## Instruction review

The automated screen found no instruction matching Forge's dangerous-instruction rules.


## Attribution

Copyright the Impeccable authors. Licensed under Apache-2.0.
The upstream maintainers do not endorse Fullstack Forge.
