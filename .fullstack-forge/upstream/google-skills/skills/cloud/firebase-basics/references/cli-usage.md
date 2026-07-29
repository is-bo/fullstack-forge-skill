<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

# Firebase CLI usage

The Firebase CLI (`firebase-tools`) is the primary tool for managing Firebase
projects and resources from the command line.

**Use npx for Firebase CLI commands**: To ensure you always use the latest
version of the Firebase CLI, always run commands with
`npx -y firebase-tools@latest` instead of just `firebase`. (e.g., use
`npx -y firebase-tools@latest --version` instead of `firebase --version`).

## Exploring commands

The Firebase CLI documents itself. Use help commands to discover functionality.

- **Global help**: List all available commands and categories:

  ```bash
  npx -y firebase-tools@latest --help
  ```

- **Command help**: Get detailed usage for a specific command:

  ```bash
  npx -y firebase-tools@latest [command] --help
  ```

  ```bash
  # Example:
  npx -y firebase-tools@latest deploy --help
  npx -y firebase-tools@latest firestore:indexes --help
  ```