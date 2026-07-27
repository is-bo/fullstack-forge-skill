# Google Skills

Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is
a pristine copy of the selected upstream files: Forge never edits it in place. Runtime
adaptations are applied by the composition compiler from declared overlays and transforms.

| Field | Value |
| --- | --- |
| Repository | `google/skills` |
| Upstream commit | `d1c9be2009ba0b9243f4ace63533684cabe0dc05` |
| Upstream tag | _none — pinned default-branch head_ |
| Licence | Apache-2.0 |
| Licence evidence | `LICENSE` |
| Files imported | 104 |
| Content checksum | `38636729b3ae06c5db6dced55a3a9c85f3aa75b006986a09220681c9c86d490a` |
| Update policy | reviewed-only |

## Selected paths

- `LICENSE`
- `skills/analytics/google-analytics-admin-api-basics/`
- `skills/analytics/google-analytics-data-api-basics/`
- `skills/cloud/agent-platform-deploy/`
- `skills/cloud/agent-platform-eval-flywheel/`
- `skills/cloud/agent-platform-inference/`
- `skills/cloud/cloud-run-basics/`
- `skills/cloud/cloud-sql-basics/`
- `skills/cloud/firebase-basics/`
- `skills/cloud/gemini-agents-api/`
- `skills/cloud/gemini-api/`
- `skills/cloud/gke-multitenancy/`
- `skills/cloud/gke-observability/`
- `skills/cloud/gke-platform-security/`
- `skills/cloud/gke-productionize/`
- `skills/cloud/gke-reliability/`
- `skills/cloud/gke-storage/`
- `skills/cloud/gke-workload-scaling/`
- `skills/cloud/gke-workload-security/`
- `skills/cloud/google-cloud-networking-observability/`
- `skills/cloud/google-cloud-solution-architecture/`
- `skills/cloud/google-cloud-storage-basics/`
- `skills/cloud/google-cloud-waf-cost-optimization/`
- `skills/cloud/google-cloud-waf-operational-excellence/`
- `skills/cloud/google-cloud-waf-performance-optimization/`
- `skills/cloud/google-cloud-waf-reliability/`
- `skills/cloud/google-cloud-waf-security/`

## Excluded paths

- `**/*.py`
- `**/*.sh`
- `**/scripts/`

## Import notes

The five Well-Architected pillars are published as `google-cloud-waf-*`; the sustainability pillar is not requested. Provider scripts (`*.py`, `*.sh`) are not imported: no Google executable may run because a Forge module loaded.

## Instruction review

The automated screen found no instruction matching Forge's dangerous-instruction rules.


## Attribution

Copyright Google LLC. Licensed under Apache-2.0.
The upstream maintainers do not endorse Fullstack Forge.
