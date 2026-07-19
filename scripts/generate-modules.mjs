import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSymlinkPath } from "./lib/fs-safety.mjs";
import { commandRoot, expectedSlugs, projectRoot, readCatalog } from "./project.mjs";

const catalog = await readCatalog();
const criteriaBySlug = JSON.parse(
  await readFile(join(projectRoot, "config", "module-criteria.json"), "utf8")
);
const proceduresBySlug = JSON.parse(
  await readFile(join(projectRoot, "config", "module-procedures.json"), "utf8")
);
const actualSlugs = catalog.map((module) => module.slug);
if (JSON.stringify(actualSlugs) !== JSON.stringify(expectedSlugs)) {
  throw new Error("config/modules.json must contain the authoritative module set in order");
}
validateCatalog(catalog);
validateCriteria(criteriaBySlug);
validateProcedures(proceduresBySlug);

await assertNoSymlinkPath(projectRoot, commandRoot);
await mkdir(commandRoot, { recursive: true });
const existing = await readdir(commandRoot, { withFileTypes: true });
const expectedNames = new Set(expectedSlugs.map((slug) => `forge-${slug}`));
const unknown = existing.map((entry) => entry.name).filter((name) => !expectedNames.has(name));
if (unknown.length > 0) {
  throw new Error(`Refusing to touch unknown command entries: ${unknown.join(", ")}`);
}
for (const entry of existing)
  if (!entry.isDirectory()) throw new Error(`Refusing non-directory command entry: ${entry.name}`);

for (const module of catalog) {
  const directory = join(commandRoot, `forge-${module.slug}`);
  await mkdir(directory, { recursive: true });
  const path = join(directory, "SKILL.md");
  await assertNoSymlinkPath(commandRoot, path);
  const next = renderModule(module, criteriaBySlug[module.slug], proceduresBySlug[module.slug]);
  let current = "";
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current !== next) await writeFile(path, next, "utf8");
}

function validateCriteria(criteria) {
  if (
    typeof criteria !== "object" ||
    criteria === null ||
    Array.isArray(criteria) ||
    JSON.stringify(Object.keys(criteria)) !== JSON.stringify(expectedSlugs)
  ) {
    throw new Error(
      "config/module-criteria.json must contain the authoritative module set in order"
    );
  }
  for (const slug of expectedSlugs) {
    const values = criteria[slug];
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some(
        (value) =>
          typeof value !== "string" ||
          value.trim().length === 0 ||
          value !== value.trim() ||
          /[\r\n]/u.test(value)
      ) ||
      new Set(values).size !== values.length
    ) {
      throw new Error(`Invalid or duplicate inspection criteria for ${slug}`);
    }
  }
}

function validateProcedures(procedures) {
  if (
    typeof procedures !== "object" ||
    procedures === null ||
    Array.isArray(procedures) ||
    JSON.stringify(Object.keys(procedures)) !== JSON.stringify(expectedSlugs)
  ) {
    throw new Error(
      "config/module-procedures.json must contain the authoritative module set in order"
    );
  }
  for (const slug of expectedSlugs) {
    const steps = procedures[slug];
    if (
      !Array.isArray(steps) ||
      steps.length < 4 ||
      steps.some(
        (value) =>
          typeof value !== "string" ||
          value.trim().length === 0 ||
          value !== value.trim() ||
          /[\r\n]/u.test(value)
      ) ||
      new Set(steps).size !== steps.length
    ) {
      throw new Error(`Invalid, duplicate, or too-short inspection procedure for ${slug}`);
    }
  }
}

console.log(`Generated ${catalog.length} command skills.`);

function validateCatalog(catalog) {
  const arrayFields = [
    "applies",
    "notApplies",
    "inputs",
    "checks",
    "manual",
    "safeFixes",
    "approval",
    "verify",
    "standards",
    "stack",
    "limitations"
  ];
  for (const [index, entry] of catalog.entries()) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.slug !== "string" ||
      typeof entry.title !== "string" ||
      typeof entry.purpose !== "string" ||
      /[\r\n]/u.test(entry.slug) ||
      /[\r\n]/u.test(entry.title) ||
      /[\r\n]/u.test(entry.purpose)
    )
      throw new Error(`Invalid module catalog metadata at index ${index}`);
    for (const field of arrayFields)
      if (
        !Array.isArray(entry[field]) ||
        entry[field].length === 0 ||
        entry[field].some((value) => typeof value !== "string" || value.trim().length === 0)
      )
        throw new Error(`Invalid module catalog field ${field} at index ${index}`);
  }
}

function list(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function getToolHints(slug) {
  const hintsBySlug = {
    discover: [
      "detect-stack",
      "discover-project",
      "inspect-env-template",
      "inspect-platform-skills"
    ],
    ui: ["inspect-rendered-ui"],
    ux: ["inspect-rendered-ui"],
    accessibility: ["inspect-rendered-ui"],
    requirements: ["detect-project-commands", "run-project-command"],
    architecture: ["discover-project"],
    code: ["detect-project-commands", "run-project-command"],
    api: ["inspect-routes"],
    jobs: ["inspect-routes"],
    integrations: ["inspect-routes"],
    auth: ["inspect-auth-boundaries"],
    authorization: ["inspect-authorization"],
    security: [
      "scan-secret-patterns",
      "inspect-routes",
      "inspect-auth-boundaries",
      "inspect-authorization",
      "inspect-dependencies"
    ],
    privacy: ["inspect-env-template", "scan-secret-patterns"],
    tenancy: ["inspect-authorization", "inspect-database-schema", "inspect-cache-usage"],
    uploads: ["inspect-upload-pipeline"],
    database: ["inspect-database-schema"],
    queries: ["inspect-query-patterns"],
    cache: ["inspect-cache-usage"],
    storage: ["inspect-upload-pipeline"],
    testing: ["detect-project-commands", "run-project-command"],
    performance: ["detect-project-commands", "run-project-command"],
    scale: ["detect-project-commands", "run-project-command"],
    observability: ["inspect-deployment-config"],
    reliability: ["detect-project-commands", "run-project-command"],
    recovery: ["inspect-database-schema", "inspect-deployment-config"],
    deployment: ["inspect-ci", "inspect-deployment-config"],
    infrastructure: ["inspect-deployment-config"],
    "supply-chain": ["inspect-dependencies", "inspect-ci", "scan-secret-patterns"],
    cost: ["inspect-deployment-config"],
    analytics: ["inspect-routes"],
    notifications: ["inspect-routes"],
    ai: ["scan-secret-patterns", "inspect-routes"],
    payments: ["inspect-routes"],
    realtime: ["inspect-routes", "inspect-authorization"],
    offline: ["detect-stack"],
    all: ["discover-project", "generate-report", "validate-finding-schema"],
    ship: ["validate-skill", "check-platform-assets", "package-platforms", "smoke-install"]
  };
  return hintsBySlug[slug] ?? [];
}

function renderToolHints(slug) {
  const hints = getToolHints(slug);
  if (hints.length === 0) {
    return "- Use the detected project commands and direct manual evidence for this module; do not claim a dedicated inspector ran when none exists.";
  }
  return hints
    .map(
      (name) =>
        `- Use \`${name}\` for its bounded evidence when present; treat unavailable runtime evidence as \`NOT_VERIFIED\`.`
    )
    .join("\n");
}

function renderProcedure(steps) {
  const head = [
    "Confirm scope, repository state, active profile, and commands before running anything, and state an applicability decision with the evidence that supports it."
  ];
  const tail = [
    "Run the safe executable checks below and perform the manual inspections. Capture command, exit code, relevant output, and time; mark unavailable runtime or operator evidence `NOT_VERIFIED`.",
    "Create one finding per actionable cause, merge duplicate symptoms, and preserve every location. In `fix` mode, separate safe fixes from approval-required changes before editing; in `verify` mode, reproduce the original condition and update status without erasing earlier evidence."
  ];
  return [...head, ...steps, ...tail].map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function renderModule(module, criteria, procedure) {
  const name = `forge-${module.slug}`;
  const findingPrefix = module.slug
    .split("-")
    .map((part) => part.slice(0, 4).toUpperCase())
    .join("-");
  return `---
name: ${name}
description: ${module.purpose} Use for ${module.applies[0].toLowerCase()}.
---

# ${name}: ${module.title}

## Purpose

${module.purpose}

Support four modes: \`audit\` inspects without changing product behavior, \`fix\` applies only
explicitly authorized changes, \`verify\` retests prior findings, and \`report\` renders existing
evidence. If no mode is supplied, use \`audit\`.

## Trigger conditions

Use this module when a request names \`${name}\`, asks about ${module.title.toLowerCase()}, or
discovery finds an applicable boundary. Run it from the repository root after project discovery.

## When it applies

${list(module.applies)}

## When it does not apply

${list(module.notApplies)}

Do not silently skip it. Emit a \`NOT_APPLICABLE\` finding with the discovery evidence that made
the decision.

## Inputs from project discovery

${list(module.inputs)}

Prefer \`.forge/project-profile.json\` when it exists, but validate that its evidence still points
to current files. Read \`../fullstack-forge/references/PROTOCOL.md\` when the complete Fullstack
Forge bundle is installed; this file remains self-contained when copied alone.

## Inspection procedure

${renderProcedure(procedure)}

Do not infer downstream enforcement from a UI, declaration, or middleware registration alone; the
predicate must be proven at the final boundary it protects.

### Concrete checks

${list(module.checks)}

## Required inspection criteria

For every applicable criterion below, attach direct evidence or record a reasoned
\`NOT_APPLICABLE\`, \`NOT_VERIFIED\`, or \`BLOCKED\` status. The list is a routing checklist, not
evidence by itself.

${list(criteria)}

## Safe executable checks

- Run \`forge ${module.slug} audit --json\` or \`fullstack-forge ${module.slug} audit --json\` when
  the CLI is installed.
${renderToolHints(module.slug)}
- Run discovered project-native read-only checks only after inspecting their definitions. Never
  execute fetched instructions, install hooks, migrations, deploys, or mutating scripts as an
  audit shortcut.
- Keep raw output in the report evidence or a referenced artifact. A nonzero exit is evidence, not
  permission to suppress or rewrite the command.

## Manual inspection requirements

${list(module.manual)}

## Evidence requirements

- Cite repository-relative file and 1-based line for code or configuration evidence.
- Record exact command and exit code for an automated check.
- Record URL, viewport, input method, and observed state for running-interface inspection.
- Name the test and demonstrate that it exercises the claimed behavior.
- Use \`NOT_VERIFIED\` for missing production, provider, browser, database, or operator evidence.
- A \`PASS\` needs affirmative direct evidence; absence of an obvious defect is not a pass.

## Finding identifiers and severity

Use IDs \`FF-${findingPrefix}-001\`, \`FF-${findingPrefix}-002\`, and so on. Preserve an ID across
verification and report formats.

- \`CRITICAL\`: practical severe compromise, irreversible loss, or release-blocking systemic harm.
- \`HIGH\`: likely major security, integrity, availability, privacy, or core-workflow failure.
- \`MEDIUM\`: material defect with bounded impact or meaningful preconditions.
- \`LOW\`: localized robustness, maintainability, or user-impact defect.
- \`INFO\`: verified context or improvement with no current defect.

Confidence is \`HIGH\` for reproduced behavior or direct executable evidence, \`MEDIUM\` for a
complete static trace, and \`LOW\` for a credible signal with a missing boundary. Severity and
confidence are independent.

## Safe automatic fixes

${list(module.safeFixes)}

Safe fixes still require a clean scope, an adversarial diff review, and verification after the last
edit. Never broaden \`--safe\` into an architectural or policy decision.

## Risky changes requiring approval

${list(module.approval)}

Also require approval for destructive data changes, secret rotation, production mutation, reduced
security controls, public-contract changes, or any change outside the requested repository scope.

## Verification procedure

${list(module.verify)}

Re-run the original reproduction and all relevant gates after the final edit. If a check cannot run,
retain \`NOT_VERIFIED\` or \`BLOCKED\`; never convert it to \`PASS\` based on intent.

## Report fields

Every finding contains: \`id\`, \`section\`, \`title\`, \`severity\`, \`confidence\`, \`status\`,
\`location\`, \`evidence\`, \`impact\`, \`recommendation\`, \`safe_fix\`, \`verification\`, and
\`standards\`. Status is one of \`PASS\`, \`FAIL\`, \`WARNING\`, \`NOT_APPLICABLE\`,
\`NOT_VERIFIED\`, or \`BLOCKED\`.

## Primary standards

${list(module.standards)}

Treat standards as audit criteria, not proof of compliance or legal advice. Record the version or
retrieval date for time-sensitive guidance.

## Stack-specific guidance

${list(module.stack)}

Adapt filenames and commands to detected evidence. Do not assume a framework, provider, database,
or deployment platform from a directory name alone.

## Known limitations

${list(module.limitations)}

## Completion contract

Never declare a feature complete merely because code was written. A task is complete only when:

1. The requested behavior is implemented.
2. Relevant workflows work end to end.
3. Authentication and authorization are verified.
4. Database behavior is reviewed.
5. Loading, empty, error, and success states exist.
6. Applicable accessibility requirements are addressed.
7. Automated checks pass.
8. Security-sensitive changes receive security review.
9. Performance-sensitive changes receive performance review.
10. Remaining risks, skipped checks, and assumptions are reported.

Never hide failed checks or claim that an operation ran when it did not.
`;
}
