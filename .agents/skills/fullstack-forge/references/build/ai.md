# Build brief: AI-enabled features

## Decide before coding

- Decide that all document, user-supplied, and web-retrieved content this feature processes is treated strictly as data to reason about, never as instructions to follow, before any prompt is assembled.
- Decide the structured output schema for the model's response and validate it strictly; do not parse free text for anything that drives a decision or an action.
- Decide the independent, non-model check for anything the model computes or extracts (totals, identifiers, amounts); the model's own confidence is not verification.
- Decide which actions this feature can take are irreversible (payment, deletion, permission change, external send) and require explicit human confirmation before execution, regardless of model confidence.
- Decide the token, cost, and rate bound for this feature's model usage before it is reachable by real traffic, including behavior when the bound is hit.

## Evidence to produce while building

- An adversarial test showing injected instructions inside document, user, or retrieved content do not change the feature's tool calls or output.
- A test showing malformed or out-of-schema model output is rejected, not silently coerced into the expected shape.
- Confirmation that model-extracted totals, identifiers, or claims are checked against an independent source before being acted on.
- A test showing an irreversible action requires explicit human confirmation and cannot be triggered by model output alone.
- Confirmation of the enforced token, cost, or rate bound for this feature, with the behavior when it is reached.
