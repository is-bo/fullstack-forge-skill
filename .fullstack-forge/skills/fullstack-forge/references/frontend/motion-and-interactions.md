# Motion and interactions

Owner: `forge-ui`, composed with `forge-ux` and `forge-accessibility`.

## Load when

- Transitions, animation, gestures, drag and drop, spatial continuity, or interaction polish is
  requested.
- Native mobile interaction is in scope.

## Do not load when

- The task has no movement or gesture behavior.
- Decorative animation is not justified by the product direction.

## Purpose first

Every motion decision must communicate causality, state, feedback, hierarchy, continuity, or
progress. Prefer immediate input feedback and interruptible transitions. Keep input available during
animation. Use a small token set for duration and easing that matches the existing product; no
universal timing value fits every platform, distance, or accessibility setting.

Prefer compositor-friendly properties on the web, but confirm the actual bottleneck before claiming
performance. Avoid layout movement that causes surrounding content to jump. Provide non-gesture
alternatives for consequential actions and do not conflict with operating-system navigation.

Reduced-motion behavior must preserve meaning, state changes, and task completion. Removing all
feedback can be as harmful as excessive movement.

## Evidence

- The state or hierarchy purpose for each added motion pattern.
- Rendered interaction at normal and reduced-motion settings.
- Keyboard and touch alternatives where applicable.
- Frame or input-latency measurement only when performance is claimed.
