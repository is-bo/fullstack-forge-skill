# Troubleshooting

## Forge does not activate automatically

Run `npx forge doctor --json`. Confirm the project install manifest reports `agent_first=true` and
`automatic_activation=true`, the relevant skill root exists, and the platform instruction listed in
[PLATFORM_SUPPORT.md](PLATFORM_SUPPORT.md) contains the Forge marker. Restart hosts that cache
skills or instructions.

## Installer refuses an instruction file

Forge will not overwrite an unowned file, a changed Forge-owned file, a modified managed section, or
a symlinked destination. Review the reported path. Preserve user content, restore the unchanged
Forge section if an update is intended, or uninstall before replacing it deliberately. Do not delete
the ownership manifest to bypass the check.

## A small edit is triggering too much work

Confirm the automatic instruction says to use Forge proportionately. Generated Forge files,
fixtures, examples, and dependency names must not activate application capabilities. For wording or
isolated UI changes, request focused validation and report a full audit as out of scope.

## A finding cannot be ingested

Run `forge tool validate-finding-schema <path>`. Agent findings require producer, evidence type,
source lines, explanation, safe-fix classification, revision, command records, and limitations. Do
not fill missing evidence with invented values; use an honest limitation.

## Ship is blocked

`forge ship` is fail-closed. Read the failed or `NOT_VERIFIED` gate, run only the named recovery
step, and rerun after the final edit. Build state and an older report cannot satisfy current Ship
evidence.
