# Optional external experts

Fullstack Forge bundles only reviewed expertise whose license, provenance, context cost, and tool
authority fit the default orchestration path. A proven specialist can instead remain a separately
installed, explicitly invoked expert. This preserves its original workflow without granting it
automatic routing or silently importing its scripts.

## Taste advisory integration

Taste is not bundled and never activates automatically. Its current v2 is experimental, very large,
and overlaps the pinned Impeccable integration, but its distinctive anti-pattern catalogue can be a
useful second opinion for an explicitly requested marketing, landing, or portfolio surface.

The reviewed source is:

- repository: <https://github.com/Leonxlnx/taste-skill>
- revision: `e988add20dab0fa97d7a76781c48961c8184288e`
- file: `skills/taste-skill/SKILL.md`
- SHA-256: `aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89`
- license: MIT; retain the upstream copyright and permission notice

To use it safely:

1. Install only the pinned upstream skill through the coding host's normal user- or project-skill
   mechanism. Verify the file hash above and retain the MIT license. Do not install the repository's
   scripts, generated assets, or repository-wide instructions as part of this integration.
2. Disable implicit invocation where the host supports it. If the host cannot prevent implicit
   activation, keep Taste out of global skill roots and use it only in an isolated project/session.
3. Explicitly request both Forge's UI expertise and the separately installed Taste skill. Ask Taste
   for an advisory comparison after Forge has inspected the real product, brand, design system, and
   rendered interface.
4. Keep the Taste pass read-only. Its suggestions cannot authorize edits, package installation,
   image generation, network access, Lighthouse execution, or a completion claim.
5. Reconcile the advice through Forge. Repository evidence, established design constraints,
   accessibility, measured performance, and verification results take precedence. When the host can
   isolate skill context, use a separate context for Taste so its roughly 22,000-token body does not
   crowd out implementation evidence.

The portable request is deliberately natural language because invocation syntax differs by host:

> Use Fullstack Forge UI and the separately installed, pinned Taste skill as a read-only advisory
> comparator for this landing page. Reconcile its observations under Forge accessibility,
> repository, and verification rules.

If the pinned file cannot be verified or the skill is not installed, report that external advisory
as `NOT_VERIFIED`; do not fetch it automatically and do not replace it with a Forge-authored
summary.

The machine-readable policy is in `config/external-experts.json`. Research and the reason for
keeping Taste external are recorded in `research/SOURCES.md`.
