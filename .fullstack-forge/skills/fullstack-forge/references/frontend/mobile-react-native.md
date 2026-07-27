# React Native and Expo

Owner: `forge-frontend`, composed with `forge-ui`, `forge-ux`, `forge-accessibility`,
`forge-offline`, and `forge-performance`.

## Load when

- Discovery proves React Native or Expo, or the request explicitly targets a native mobile app.

## Do not load when

- The project is web-only or “mobile” means a narrow browser viewport.

## Detect the platform contract

Record React Native, Expo SDK, router/navigation, styling, state, data, and list libraries from the
project. Prefer the existing supported stack. Confirm version-specific APIs before recommending
them; do not introduce a navigation, list, image, or animation dependency as a generic default.

Use native semantics, safe areas, system back behavior, keyboard avoidance, dynamic text, platform
themes, and standard gestures. Adapt top-level navigation and controls to platform conventions while
preserving shared product language. Keep critical controls clear of system gesture regions.

Define offline, slow-network, retry, cancellation, optimistic rollback, queued action, conflict,
revocation, and stale-data behavior when applicable. Virtualize and tune lists from measured data
volume and device evidence, not a fixed item-count rule.

## Verification

Exercise representative iOS and Android targets when available, including orientation, largest text,
screen reader semantics, keyboard, safe areas, slow network, offline transition, and app resume.
State exactly which device, simulator, platform, and SDK were not tested.
