# Product gap report — v0.5.2

## Reproduced gap

`forge all audit` aborted before findings when a normal project contained more than 128 MiB of
generated output. The retained reproduction used 220 `.next/cache/chunks` files totaling 135,168,000
bytes and failed with:

```text
Fullstack Forge: Repository scan exceeded the 134217728-byte inspection budget.
```

## Confirmed causes

- A generic recursive walker charged metadata size before text, binary, relevance, or generated
  classification.
- Capability discovery and downstream inspectors repeated repository walks with different
  exclusions.
- Git ignores, `.forgeignore`, and CLI exclusions were not a shared evidence policy.
- Working-tree revision loaded untracked file contents and buffered binary diffs independently.
- Exhaustion threw away useful evidence instead of producing an incomplete evidence state.

## Required outcome

Normal full-stack repositories must complete discovery without generated output, caches, virtual
environments, binaries, or runtime data consuming the text budget. Genuinely excessive relevant text
must preserve evidence, remain `NOT_VERIFIED`, and exit `2`. Exclusions must never manufacture
absence or Ship readiness.

The implemented design and regression evidence are recorded in
[PRODUCT_LAYER_DESIGN_v0.5.2.md](PRODUCT_LAYER_DESIGN_v0.5.2.md),
[REPOSITORY_INVENTORY.md](REPOSITORY_INVENTORY.md), and
[RELEASE_VERIFICATION_v0.5.2.md](RELEASE_VERIFICATION_v0.5.2.md).
