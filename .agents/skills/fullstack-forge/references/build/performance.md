# Build brief: Performance

## Decide before coding

- Decide whether this feature has a performance requirement worth measuring at all before optimizing anything; no stated requirement means no performance work is owed yet.
- If there is a requirement, decide the representative workload, data size, and target percentile before writing code aimed at meeting it.
- Decide where the dominant cost is likely to be (network, database, rendering, computation) before changing code, rather than guessing and tuning the wrong layer.
- Decide what 'good enough' means in a measurable number for this path, so later changes can be checked against it instead of debated.
- Decide whether an optimization changes observable behavior (approximation, caching, denormalization); if so, treat it as a behavior decision, not a free win.

## Evidence to produce while building

- The stated performance requirement (or the recorded absence of one) this feature is measured against.
- A measurement of the actual bottleneck before the optimization, not an assumption.
- A repeated measurement after the change, under the same representative workload, showing the target is met.
- Confirmation that correctness and tail latency did not regress alongside the improved metric.
