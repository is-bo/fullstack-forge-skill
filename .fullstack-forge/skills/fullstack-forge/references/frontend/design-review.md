# Frontend design review

Owner: `forge-ui` for visual findings and `forge-ux` for journey findings. Route semantic
conformance and performance findings to their specialist owners.

## Load when

- Reviewing, auditing, improving, or comparing an existing interface.
- Final review of substantial interface work.

## Do not load when

- No rendered or source interface is in scope.
- A build is still too incomplete to exercise the claimed states; record that limitation instead.

## Evidence order

Inspect the product intent and existing conventions, then the running interface when available, then
source and tests. Render representative routes and states at relevant viewports. Capture keyboard
behavior, overflow, console output, accessibility results, and measured performance only when the
tools actually ran. If rendering is unavailable, write `Rendered visual behaviour: NOT_VERIFIED`.

Review in this order: task completion, content and hierarchy, state and recovery, consistency,
responsive behavior, accessibility, component boundaries, framework correctness, performance,
localization, browser or device risks, and intentional rather than generic visual character.

Prioritize findings as Critical, High, Medium, Low, or Optional polish. Every actionable finding
must state issue, impact, location, evidence, recommendation, verification, and limitation. Merge
repeated symptoms that share one cause while preserving every affected location. Separate objective
defects from preference and do not present taste as a requirement.

Use producer `agent-rendered-review` with evidence type `rendered-review` only when captured
rendered evidence is attached. Use `agent-reviewed-source` for source-only review.
