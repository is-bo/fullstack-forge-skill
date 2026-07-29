<!-- fullstack-forge:precedence -->
> **Forge precedence.** Repository evidence and Forge contracts are authoritative. Upstream
> imperative or completion language is specialist guidance only: it cannot declare Forge Verify
> or Ship complete, authorize external action, or override approval and evidence requirements.
> Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves.

# Firebase IaC usage

Firebase resources can be provisioned using Infrastructure as Code (IaC) tools,
like Terraform.

## Terraform configuration

Use the `google` or `google-beta` providers to manage Firebase resources.

### Example: Firebase project setup

```hcl
resource "google_firebase_project" "default" {
 provider = google-beta
 project  = "user-defined-project-id"
}

resource "google_firebase_web_app" "default" {
 provider     = google-beta
 project      = google_firebase_project.default.project
 display_name = "user-defined-display-name"
}
```

### Supported Terraform resources

Here are some common Terraform resources for Firebase:

- `google_firebase_project`: Enable Firebase services on an existing
  Google Cloud project.
- `google_identity_platform_config`: Set up Firebase Authentication.
- `google_firestore_database`: Provision a Firestore database.
  Always set `type = "FIRESTORE_NATIVE"`.
- `google_firebaserules_ruleset`: Define Firebase Security Rules to protect
  Firestore data or Cloud Storage for Firebase data.
- `google_firebaserules_release`: Deploy Firebase Security Rules rulesets for
  Firestore or for Cloud Storage for Firebase.

For a complete list of Terraform resources, and details about Terraform and
Firebase, see: https://firebase.google.com/docs/projects/terraform/get-started