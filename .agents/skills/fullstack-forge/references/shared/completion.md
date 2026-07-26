# Applicability-aware completion policy

A task is complete only when the requested behavior is implemented and every applicable completion
condition is satisfied. Completion conditions apply only when the change can affect that concern.

- **Authentication and authorization:** required when work affects identity, permissions, protected
  actions, tenant boundaries, or sensitive data.
- **Database behavior:** required when work reads, writes, filters, sorts, paginates, migrates, or
  otherwise changes persisted data.
- **Workflow states:** loading, empty, error, success, permission, partial, and offline states are
  required when those states can occur in the affected workflow.
- **Accessibility:** required for every user-facing change, proportionate to the affected
  interaction.
- **Security review:** required when work changes a trust boundary or handles sensitive input,
  identity, secrets, uploads, payments, permissions, or personal data.
- **Performance review:** required when work changes performance-sensitive behavior or makes a
  performance claim.
- **Runtime or rendered verification:** required when correctness depends on observed runtime or
  visual behavior and the necessary tools are available. Otherwise keep that proof `NOT_VERIFIED`.
- **Automated checks:** required when relevant project checks exist and can be run safely.

Use direct scope evidence to decide applicability before implementation and revisit the decision
when the diff changes the boundary. A concern shown to be outside the affected workflow receives a
reasoned `NOT_APPLICABLE` in an audit or remains outside a non-audit plan. It never receives `PASS`.
An applicable condition without evidence remains `NOT_VERIFIED` or `BLOCKED`; it does not disappear.

Never hide failed checks or claim that an operation ran when it did not.
