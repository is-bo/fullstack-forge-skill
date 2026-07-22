# Release-readiness checklist

- [ ] Project profile and findings were re-derived from a stable current revision; prior reports are
      diagnostics only.
- [ ] Format, lint, typecheck, unit, integration, end-to-end, and production build gates pass or are
      explicitly non-applicable.
- [ ] Required security, dependency, authorization, upload, migration, and license checks have
      current registered, root/revision/artifact-bound evidence and pass.
- [ ] No open critical or required high finding remains.
- [ ] No required high-risk check remains `NOT_VERIFIED`.
- [ ] Canonical and generated platform assets match ownership manifests.
- [ ] Skill schemas and every command skill validate.
- [ ] Packages are deterministic, have checksums, and exclude local/private material.
- [ ] Clean installation and invocation smoke tests pass without symlinks.
- [ ] Release notes, rollback, residual risk, and human-only publication steps are accurate.
