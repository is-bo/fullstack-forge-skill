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
| Files imported | 92 |
| Content checksum | `e60ee707fca23756b304b7b134dca85615e4b89b35cca9957409c82d61eb75fe` |
| Update policy | reviewed-only |

## Selected paths

- `LICENSE`
- `skills/analytics/google-analytics-admin-api-basics/`
- `skills/analytics/google-analytics-data-api-basics/`
- `skills/cloud/cloud-run-basics/`
- `skills/cloud/cloud-sql-basics/`
- `skills/cloud/firebase-basics/`
- `skills/cloud/gemini-api/`
- `skills/cloud/gke-multitenancy/`
- `skills/cloud/gke-observability/`
- `skills/cloud/gke-platform-security/`
- `skills/cloud/gke-productionize/`
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

The automated screen recorded the hits below. Each was reviewed against Forge's approval boundaries; guidance that merely *describes* an operation is advisory, and no vendored instruction can bypass a Forge contract at runtime.

- `foreign-skill-install` **(hard-deny rule)** — `skills/cloud/firebase-basics/SKILL.md`: rns. Run this command: ```bash npx -y skills add firebase/agent-skills -y ``` *If the skills are alrea
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloud/firebase-basics/references/client-library-usage.md`: ese skills by running: ```bash npx -y skills add firebase/agent-skills -y ``` - For **native iOS or Andr
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloud/firebase-basics/references/iam-security.md`: stall these skills by running: ```bash npx -y skills add firebase/agent-skills -y ``` ## Firebase App Check Firebase
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloud/google-cloud-storage-basics/references/data-management.md`: en proceed once it is > installed: `npx skills add gemini-cli-extensions/google-cloud-storage > --skill gcs-secu
- `foreign-skill-install` **(hard-deny rule)** — `skills/cloud/google-cloud-storage-basics/references/data-management.md`: ve > the user this exact command to install the skill, then proceed once it is > installed: `npx skills add gemi

## Attribution

No explicit upstream copyright notice was published. Licensed under Apache-2.0.
The upstream maintainers do not endorse Fullstack Forge.
