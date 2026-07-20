# Build brief: Deployment

## Decide before coding

- Decide the migration-to-code deploy ordering for this change (expand-contract) before assuming old and new code never coexist during rollout.
- Decide the health check or readiness signal this feature affects, and confirm rollout will not mark the service healthy before this feature is actually ready.
- Decide the rollback path for this change: what a rollback of the code without a schema rollback looks like, if a migration is involved.
- Decide which configuration or secrets this feature needs in each environment before deploying it anywhere, rather than discovering a missing value in production.
- Decide the smoke check that proves this feature actually works post-deploy, not just that the build succeeded.

## Evidence to produce while building

- Confirmation that the migration for this change is compatible with the previous code version during a rolling deploy.
- A rollback or forward-fix exercised in an isolated environment for this change.
- The post-deploy smoke check result specific to this feature, not just a generic health endpoint.
- Confirmation that required configuration and secrets are present in every target environment before deploy.
