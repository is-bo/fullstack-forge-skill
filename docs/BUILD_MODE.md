# Build mode and automatic feature work

The agent-first workflow is the default when Forge is installed. Explicit Build commands remain a
durable state and enforcement option; they are not required for every change.

## Proportional workflow

| Risk     | Typical work                                                                                           | Required behavior                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Light    | wording, styling, isolated UI, documentation                                                           | inspect affected area, edit, focused validation                                                        |
| Standard | forms, endpoints, CRUD, notifications, dashboards                                                      | inspect architecture, select modules, brief plan, implementation/tests, focused checks, one final pass |
| High     | identity, permissions, money, personal data, uploads, destructive migrations, secrets, sensitive cache | stronger playbooks/evidence, approval boundaries, unsupported-completion block                         |

Do not initialize Build state or run every module for a tiny edit. Do not add queues, caches,
microservices, or providers without measured need.

## Explicit lifecycle

```text
forge build <request>
forge feature <slug> frame
forge feature <slug> plan
forge feature <slug> check --allow-run
forge feature <slug> done
forge continue
```

State lives under `.forge/build/`. `frame` and `plan` are recorded guidance. `check` and `done`
re-derive applicability and accept positive results only from registered, current evidence.
High-risk signals set a tier floor unless an explicit reason is recorded. Repair cycles are bounded.

Build evidence cannot satisfy Audit or Ship gates. See [ARCHITECTURE.md](ARCHITECTURE.md).
