# Contributing

Thank you for improving Fullstack Forge. Changes should make audits more reproducible, safer, or
more useful across real application stacks.

## Setup

```bash
git clone https://github.com/thethunderbolt/fullstack-forge-skill.git
cd fullstack-forge-skill
npm ci
npm run check
```

Node.js 24 or newer is required. Use the locked npm dependency graph. Do not execute scripts from
research repositories; they are conceptual references only.

## Change workflow

1. Start from an issue or a concise, falsifiable requirement.
2. Edit canonical files under `src/fullstack-forge/`, CLI TypeScript under `cli/`, module data under
   `config/`, or generator sources under `scripts/`.
3. Run `npm run generate`; never hand-edit generated platform copies.
4. Add or update a fixture and a test for behavior changes.
5. Run focused tests, then `npm run check` after the last edit.
6. Review the diff for secret exposure, path traversal, unsafe subprocesses, unowned overwrites,
   inaccurate PASS claims, stale attribution, and private/local files.

For Build-mode evidence changes, update the exact producer registry and code-owned gate plan
together. A command producer is keyed by both script and criterion; never add a generic exit-zero
promotion, state-defined producer, or manual route to `PASS`. Cover wrong-criterion, missing tool,
unauthorized/offline execution, stale input, cross-root/revision, expiry, and artifact tampering,
and add a fixed public prevention evaluation. See
[the contributor contract](docs/ADDING_A_MODULE.md#build-producer-and-gate-interfaces).

Use Conventional Commit subjects such as `feat(cli): add safe update conflicts` or
`docs: clarify Gemini skill discovery`.

## Audit content

A command module must have concrete applicability, inputs, steps, executable and manual checks,
evidence requirements, stable finding IDs, severity guidance, safe and risky changes, verification,
standards, stack guidance, limitations, and the completion contract. Avoid vague “check best
practices” guidance.

Adapt concepts, not prose or code, from research sources. Update `research/SOURCES.md`,
`research/LICENSE_MATRIX.md`, and `THIRD_PARTY_NOTICES.md` when adding a source.

## Pull requests

Describe the requirement, evidence, tests, generated-file impact, risk, and remaining limitations.
Do not include credentials, private reports, production data, screenshots containing personal data,
or local specification files.
