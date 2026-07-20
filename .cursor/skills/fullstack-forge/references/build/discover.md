# Build brief: Project discovery

## Decide before coding

- Profile the project before writing a line: languages, frameworks, package manager, data stores, auth provider, and existing conventions, so new code matches what already exists instead of introducing a second pattern.
- Identify the nearest existing example of the thing you are about to build (a similar route, component, job, or migration) and follow its shape unless there is a recorded reason to diverge.
- Decide which boundaries this feature touches (public, private, admin, tenant, upload, payment, AI) using file evidence, not assumption, before scoping the plan.
- If a monorepo or multi-app layout exists, decide which app or package owns this change and respect its own tooling rather than the repository root's.
- Record any detected convention you are deliberately not following, and why, so reviewers do not mistake divergence for oversight.

## Evidence to produce while building

- A short list of the conventions actually followed (naming, error handling, folder placement, test style) with file references.
- A note on which boundaries the feature touches, grounded in the files that prove each one.
- Confirmation that no parallel pattern was introduced where an established one already covers the same need.
- Any recorded non-goal or deliberate deviation from existing convention, with the reason.
