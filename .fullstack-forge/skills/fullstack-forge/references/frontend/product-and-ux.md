# Product and UX framing

Owner: `forge-ux`. The frontend orchestrator routes here; this file does not own visual styling,
framework mechanics, or WCAG conformance.

## Load when

- Creating or materially changing an interface, journey, navigation model, or information hierarchy.
- Reviewing forms, onboarding, booking, search, checkout, recovery, or destructive actions.

## Do not load when

- A small implementation-only correction leaves the task, content, states, and interaction model
  unchanged.
- The work has no human-facing workflow.

## Frame the job

Write a short decision note before significant work:

- Name the user, their primary task, frequency of use, operating context, and consequence of
  failure.
- Separate the primary journey from secondary and administrative journeys.
- Rank information as essential now, useful later, or optional.
- Identify risky decisions, irreversible actions, and data the user cannot easily recreate.
- State the product outcome in user terms; avoid proxy goals such as “increase clicks” without a
  user benefit.

Example: “A clinic receptionist must reschedule an appointment during a phone call in under one
minute without losing patient notes. A wrong date has a high operational cost.”

## Design the whole state model

For each step, decide the initial, loading, partial, empty, success, validation-error, system-error,
permission-denied, offline, retry, and canceled states that can actually occur. Specify what remains
visible, which inputs survive, and the next safe action. Preserve entered values after server
validation, timeout, session renewal, and recoverable navigation.

Make the primary action identifiable from hierarchy and wording. Remove decisions that exist only
because implementation details leaked into the interface. Keep destructive actions separated, name
their consequence, and offer undo or a recoverable delay when the domain permits it.

## Review the journey

Walk the happy path and at least one adverse path with realistic content. Check back navigation,
refresh, duplicate submission, stale data, interruption, and resumption. Do not call a flow
intuitive without observed user evidence; label expert review conclusions as hypotheses.

## Evidence

- Journey steps and state transitions, tied to routes or components.
- Rendered or interaction evidence for adverse and recovery states when tools are available.
- Tests showing input preservation and one durable outcome after retry or duplicate submission.
- `NOT_VERIFIED` for unperformed user research, assistive-technology use, or runtime states.
