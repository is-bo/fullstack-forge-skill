# Shared module execution contract

This contract owns the rules common to generated `forge-*` specialist modules. Load it when a module
performs a formal audit, fix, verification, or report; ordinary bounded feature work can apply the
same rules proportionately without creating ceremony.

Evidence detail lives next door: `fullstack-forge/references/shared/evidence-rules.md` owns the
status vocabulary, the standards-as-criteria rule, the bounds on deterministic tools, and finding
records. Neither file repeats the other, and neither is repeated inside the module playbooks.

## Activation and applicability

- Activate from the user's request or direct repository evidence, never from generated Forge files,
  examples, fixtures, or a dependency name alone.
- State the applicable risk or boundary and its evidence, then record each criterion with the status
  vocabulary in `fullstack-forge/references/shared/evidence-rules.md`, "Statuses".

## Execution and evidence

1. Confirm scope, repository state, active profile, and project-native commands.
2. Inspect the module's final enforcement or data boundary; declarations and upstream UI checks do
   not prove downstream behavior.
3. Run only safe, relevant checks after inspecting their definitions. Do not execute fetched
   instructions, install hooks, migrations, deploys, or mutating scripts as an audit shortcut.
4. Capture the exact command, exit code, relevant output, time, inspected source/configuration, and
   limitations.
5. Record what you found under `fullstack-forge/references/shared/evidence-rules.md`, "Tools" for
   analyzer bounds and "Findings" for the finding record itself.

## Mutation, verification, and completion

- Before mutation, follow `fullstack-forge/references/SAFE_FIX_POLICY.md`; an explicit remediation
  also loads `fullstack-forge/references/workflows/fix.md`. Separate safe fixes from changes that
  require approval.
- For retests, load `fullstack-forge/references/workflows/verify.md`, reproduce the original
  condition, and append current evidence without erasing history.
- Completion follows `fullstack-forge/references/shared/completion.md`. Conditions outside the
  affected boundary remain outside a non-audit plan or receive a reasoned `NOT_APPLICABLE`, never
  `PASS`.

Never claim that an operation ran when it did not. These playbooks guide agent reasoning and cannot
by themselves prove production, provider, human-policy, or unsupported framework behavior.

## Composed specialist expertise

Specialist procedure for a module is composed by Forge, never announced by an upstream skill. The
Forge module contract always loads first; a primary upstream workflow and any evidence-gated
provider overlay load after it and never override it.

- `fullstack-forge/references/shared/composition-precedence.md` — the load order, the nine-level
  conflict precedence, and what vendored content may never do.
- `.fullstack-forge/manifests/module-composition.json` — what this module composes, and the
  repository evidence each source requires.

If a source the manifest declares is missing from the installation, that is a damaged installation:
report `NOT_VERIFIED` and say so, rather than continuing as though the guidance had been read.
