# Explicit external experts

Load this reference only after the user explicitly names a separately installed external expert.
External experts never participate in automatic composition.

## Taste

- Treat Taste as a read-only advisory comparator, not a Forge finding or completion authority.
- Require the separately installed upstream file at revision
  `e988add20dab0fa97d7a76781c48961c8184288e` with SHA-256
  `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`.
- Preserve the upstream skill's original workflow. Do not paraphrase or merge its full body into
  Forge, and do not load it merely because the task involves a user interface.
- Prefer an isolated context after Forge has inspected the product, brand, design system, and
  rendered interface. If isolation is unavailable, load it for a separate pass so its large body
  does not displace implementation evidence.
- It cannot authorize edits, dependencies, network requests, image generation, Lighthouse runs, or
  completion claims. Those actions retain their normal Forge approval and evidence requirements.
- Repository truth, established design constraints, accessibility, measured performance, and Forge
  verification take precedence. Classify unresolved subjective disagreement as advisory.
- If the host cannot verify or load the pinned skill, report the external pass as `NOT_VERIFIED`.
  Never download or install it during task execution.

The upstream project is <https://github.com/Leonxlnx/taste-skill> under the MIT license. A user who
installs it must retain the upstream copyright and permission notice. Full installation guidance is
in the package's `docs/EXTERNAL_EXPERTS.md`.
