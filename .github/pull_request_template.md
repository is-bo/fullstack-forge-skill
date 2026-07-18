## Change

Describe the user-visible outcome and the evidence that motivated it.

## Safety and compatibility

- [ ] I reviewed path, subprocess, secret, authorization, and destructive-action boundaries that
      apply.
- [ ] Generated platform files were changed only through the canonical source and generator.
- [ ] No credential, private report, production data, research clone, or local specification is
      included.
- [ ] License/attribution records are complete for adapted concepts or assets.

## Verification

- [ ] `npm run check`
- [ ] `npm run package:platforms` when packaging or generated assets changed
- [ ] `npm run smoke:install` when CLI, installer, package, or platform output changed
- [ ] I inspected the final diff and documented any `NOT_VERIFIED` or manual remainder.

Include exact commands, exit status, and relevant redacted output. A passing process alone is not an
audit pass.
