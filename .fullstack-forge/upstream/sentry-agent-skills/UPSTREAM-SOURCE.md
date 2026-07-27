# Sentry Agent Skills

Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is
a pristine copy of the selected upstream files: Forge never edits it in place. Runtime
adaptations are applied by the composition compiler from declared overlays and transforms.

| Field | Value |
| --- | --- |
| Repository | `getsentry/sentry-agent-skills` |
| Upstream commit | `9f54eb021916a7cff2c04a9f4e4c1f9439f3202c` |
| Upstream tag | _none — pinned default-branch head_ |
| Licence | Apache-2.0 |
| Licence evidence | `README.md#license` |
| Files imported | 61 |
| Content checksum | `18067aa3313135f9a31506ca55a185f53f703d23df7a1722241febf17fe47a26` |
| Update policy | reviewed-only |

## Selected paths

- `README.md`
- `skills/sentry-dotnet-sdk/`
- `skills/sentry-fix-issues/`
- `skills/sentry-go-sdk/`
- `skills/sentry-nextjs-sdk/`
- `skills/sentry-otel-exporter-setup/`
- `skills/sentry-pr-code-review/`
- `skills/sentry-python-sdk/`
- `skills/sentry-react-native-sdk/`
- `skills/sentry-react-sdk/`
- `skills/sentry-ruby-sdk/`
- `skills/sentry-setup-ai-monitoring/`
- `skills/sentry-svelte-sdk/`

## Import notes

The repository has no LICENSE file at the pinned commit; Apache-2.0 is declared in README.md, recorded verbatim in SOURCE.md. `sentry-setup-metrics` does not exist upstream at this commit — metrics guidance ships only as per-SDK `references/metrics.md`, which is imported with the Go, Python, and Ruby bundles. `sentry-cocoa-sdk` is excluded (no Forge Swift/Objective-C support) as are `sentry-sdk-skill-creator` and `sentry-create-alert`.

## Instruction review

The automated screen recorded the hits below. Each was reviewed against Forge's approval boundaries; guidance that merely *describes* an operation is advisory, and no vendored instruction can bypass a Forge contract at runtime.

- `telemetry` **(hard-deny rule)** — `skills/sentry-nextjs-sdk/references/error-monitoring.md`: , componentStack, eventId) => { analytics.track("error_boundary", { eventId }); }} > <CheckoutFl
- `telemetry` **(hard-deny rule)** — `skills/sentry-react-sdk/references/error-monitoring.md`: <Sentry.ErrorBoundary onMount={() => analytics.track("error_boundary_mounted", { section: "dashboard" })} onUnmount

## Attribution

Copyright Functional Software, Inc. dba Sentry. Licensed under Apache-2.0.
The upstream maintainers do not endorse Fullstack Forge.
