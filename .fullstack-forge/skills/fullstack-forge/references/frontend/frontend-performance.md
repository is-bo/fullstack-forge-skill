# Frontend performance

Owner: `forge-performance`, integrated by `forge-frontend`.

## Load when

- The request names responsiveness, loading speed, bundle size, hydration, rendering cost, lists,
  media, or a performance regression.
- A substantial route introduces a plausible budget risk.

## Do not load when

- No requirement or plausible user-visible performance risk exists.
- The only evidence is a stylistic preference for “faster.”

## Measure before changing

Define the user journey, production build, device class, network, data size, cold or warm state,
metric, percentile, and budget. Capture a repeatable baseline. Identify the dominant cost among
network waterfalls, server response, client JavaScript, rendering, media, fonts, third parties, and
main-thread work before choosing a remedy.

Prefer structural wins: remove sequential dependencies, avoid duplicate work, ship less client code,
reserve media dimensions, prioritize true critical assets, paginate or virtualize only when the
measured list needs it, and prevent unnecessary rendering at the owning boundary. Do not trade
correctness, accessibility, or offline behavior for a synthetic score.

## Verification

Repeat the same workload after the final edit and report uncertainty and environmental limits. Check
tail behavior and correctness as well as the improved metric. Treat lab results, field data, bundle
inspection, and profiler traces as different evidence types; do not substitute one for another.

Record `NOT_VERIFIED` when browser, device, production telemetry, or representative data is absent.
