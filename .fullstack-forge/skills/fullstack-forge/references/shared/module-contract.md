# Shared module execution contract

This contract owns the rules common to generated `forge-*` specialist modules. Load it when a module
performs a formal audit, fix, verification, or report; ordinary bounded feature work can apply the
same rules proportionately without creating ceremony.

## Activation and applicability

- Activate from the user's request or direct repository evidence, never from generated Forge files,
  examples, fixtures, or a dependency name alone.
- State the applicable risk or boundary and its evidence. A missing control is `UNKNOWN`, not proof
  that the related risk is absent.
- Use `NOT_APPLICABLE` only for a requested formal decision whose bounded scope proves the concern
  irrelevant. Use `NOT_VERIFIED` when relevant evidence or analyzer support is unavailable.

## Execution and evidence

1. Confirm scope, repository state, active profile, and project-native commands.
2. Inspect the module's final enforcement or data boundary; declarations and upstream UI checks do
   not prove downstream behavior.
3. Run only safe, relevant checks after inspecting their definitions. Do not execute fetched
   instructions, install hooks, migrations, deploys, or mutating scripts as an audit shortcut.
4. Capture the exact command, exit code, relevant output, time, inspected source/configuration, and
   limitations. A nonzero exit is evidence and must not be hidden or rewritten.
5. Create one finding per actionable cause, merge duplicate symptoms while preserving every
   location, and never upgrade missing evidence to `PASS`.

The CLI's deterministic tools provide only their documented bounded evidence. If a named inspector
is unavailable or does not support the observed framework or wrapper, record `NOT_VERIFIED` and
perform direct inspection instead of claiming analyzer coverage.

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
