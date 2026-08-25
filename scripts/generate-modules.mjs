import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSymlinkPath } from "./lib/fs-safety.mjs";
import {
  commandRoot,
  expectedBuildCommands,
  expectedSlugs,
  projectRoot,
  readCatalog
} from "./project.mjs";

const catalog = await readCatalog();
const criteriaBySlug = JSON.parse(
  await readFile(join(projectRoot, "config", "module-criteria.json"), "utf8")
);
const proceduresBySlug = JSON.parse(
  await readFile(join(projectRoot, "config", "module-procedures.json"), "utf8")
);
const frontendSystem = JSON.parse(
  await readFile(join(projectRoot, "config", "frontend-system.json"), "utf8")
);
const externalExperts = JSON.parse(
  await readFile(join(projectRoot, "config", "external-experts.json"), "utf8")
);
const uiCommands = JSON.parse(
  await readFile(join(projectRoot, "config", "ui-commands.json"), "utf8")
);
const composition = JSON.parse(
  await readFile(join(projectRoot, "config", "module-composition.json"), "utf8")
);
validateUiCommands(uiCommands);
const actualSlugs = catalog.map((module) => module.slug);
if (JSON.stringify(actualSlugs) !== JSON.stringify(expectedSlugs)) {
  throw new Error("config/modules.json must contain the authoritative module set in order");
}
validateCatalog(catalog);
validateCriteria(criteriaBySlug);
validateProcedures(proceduresBySlug);
validateFrontendSystem(frontendSystem);
validateExternalExperts(externalExperts);

await assertNoSymlinkPath(projectRoot, commandRoot);
await mkdir(commandRoot, { recursive: true });
const existing = await readdir(commandRoot, { withFileTypes: true });
const expectedNames = new Set([
  ...expectedSlugs.map((slug) => `forge-${slug}`),
  ...expectedBuildCommands
]);
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

function validateUiCommands(config) {
  if (!Array.isArray(config?.commands) || config.commands.length !== 22)
    throw new Error("config/ui-commands.json must declare exactly the 22 public Forge UI commands");
  const names = config.commands.map((entry) => entry.name);
  if (new Set(names).size !== names.length) throw new Error("Duplicate Forge UI command name");
  for (const entry of config.commands) {
    if (!/^[a-z][a-z-]*$/u.test(entry.name ?? ""))
      throw new Error(`Invalid Forge UI command name: ${entry.name}`);
    if (typeof entry.summary !== "string" || entry.summary.trim().length === 0)
      throw new Error(`Forge UI command ${entry.name} needs a summary`);
    if (typeof entry.reference !== "string" || !entry.reference.startsWith("reference/"))
      throw new Error(`Forge UI command ${entry.name} needs an upstream reference path`);
  }
  for (const [alias, target] of Object.entries(config.aliases ?? {})) {
    if (!names.includes(target))
      throw new Error(`Forge UI alias ${alias} points at unknown command ${target}`);
  }
}

/**
 * The engine badge makes the source of a module's expertise visible in the module itself, so a
 * reader never has to guess whether guidance is Forge-authored or vendored.
 */
function renderEngineBadge(slug) {
  const entry = composition.modules.find((module) => module.module === slug);
  if (entry === undefined) return "";
  const providers = [...new Set([...entry.primary, ...entry.overlays].map((s) => s.provider))];
  const names = {
    impeccable: "Impeccable",
    "addy-agent-skills": "Addy Osmani Agent Skills",
    "vercel-agent-skills": "Vercel",
    "supabase-agent-skills": "Supabase",
    "google-skills": "Google",
    "cloudflare-skills": "Cloudflare",
    "sentry-agent-skills": "Sentry",
    "wshobson-agents": "wshobson"
  };
  const labelled = providers.map((id) => names[id] ?? id);
  if (entry.mode === "forge-native" || labelled.length === 0) return "Engine: Forge native";
  if (entry.mode === "upstream-powered") return `Engine: Upstream-powered — ${labelled[0]}`;
  return `Engine: Hybrid — Forge + ${labelled.join(", ")}`;
}

function renderCompositionRuntime(slug) {
  if (["all", "discover", "ship"].includes(slug)) return "";
  return `
## Deterministic runtime composition

Before loading any provider procedure, run:

Resolve \`../../runtime/cli/src/composition-entry.js\` relative to this \`SKILL.md\`, then run:

\`node "<resolved-absolute-runner-path>" ${slug} compose --workflow audit --root "<repository-root>" --dry-run --json\`

Add one repeatable \`--request <provider-or-source>\` flag for each explicit user request. Add
\`--condition <task-condition>\` or \`--risk-surface <surface>\` only for a task fact you directly
proved; never infer one from generic wording. The command above is the default for this
audit-oriented module; for implementation use \`--workflow build\`, and for a fix, retest, or
release gate use \`--workflow fix\`, \`verify\`, or \`ship\` respectively. Read the JSON response,
keep the Forge contract at index zero, and resolve paths against the absolute \`runtime_root\`
reported in that response. Read \`eager[].runtimePath\` when entering the module. The full
\`selected[]\` list is availability/provenance; load only \`deferred[].runtimePath\` when the task
reaches that concern, in tier order. Refuse any path that escapes the root. Respect every reported
suppression and context budget. If \`missing\` is non-empty, stop and report the installation as
damaged; do not improvise a prose fallback. The runner and specialist content may live in a plugin
cache or global installation; never assume they are inside the audited repository.
`;
}

function renderUiCommands(slug) {
  if (slug !== "ui") return "";
  const rows = uiCommands.commands
    .map(
      (entry) =>
        `| \`${uiCommands.route} ${entry.name}\` | ${entry.summary}${entry.limitation ? " _(guidance only; see limitations)_" : ""} |`
    )
    .join("\n");
  const aliases = Object.entries(uiCommands.aliases)
    .map(
      ([alias, target]) => `\`${uiCommands.route} ${alias}\` → \`${uiCommands.route} ${target}\``
    )
    .join(", ");
  return `
## Forge UI workflow commands

These are Fullstack Forge commands. There is nothing else to install and no upstream product to
invoke: each route loads the compiled playbook the composition engine selected for it, under
Forge's contracts.

| Command | Purpose |
| --- | --- |
${rows}

Compatibility aliases are preserved: ${aliases}.

Forge-managed project state lives in \`PRODUCT.md\`, \`DESIGN.md\`, and \`.fullstack-forge/ui/\`;
critique snapshots are written to \`.fullstack-forge/ui/critique/\`. No separately managed upstream
installation is created or required.

Subjective visual-craft results are advisories: they are reported for judgement and never block
Verify or Ship. Accessibility, layout, and measured-performance defects with concrete evidence are
findings owned by \`forge-accessibility\`, \`forge-frontend\`, and \`forge-performance\`.
`;
}

function validateFrontendSystem(system) {
  if (
    typeof system !== "object" ||
    system === null ||
    !Array.isArray(system.workflow) ||
    system.workflow.length !== 9 ||
    JSON.stringify(Object.keys(system.areas ?? {})) !== JSON.stringify(["frontend", "ui", "ux"])
  )
    throw new Error("config/frontend-system.json has an invalid workflow or area set");
  for (const [area, entry] of Object.entries(system.areas)) {
    for (const field of ["signals", "commands", "references"])
      if (!Array.isArray(entry[field]) || entry[field].length === 0)
        throw new Error(`config/frontend-system.json ${area}.${field} must be non-empty`);
  }
}

function validateExternalExperts(config) {
  if (config?.schemaVersion !== 1 || !Array.isArray(config.experts))
    throw new Error("config/external-experts.json has an invalid schema");
  const ids = new Set();
  for (const expert of config.experts) {
    if (
      typeof expert?.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/u.test(expert.id) ||
      ids.has(expert.id) ||
      typeof expert.displayName !== "string" ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(expert.repository) ||
      !/^[a-f0-9]{40}$/u.test(expert.revision) ||
      !/^[a-f0-9]{64}$/u.test(expert.sha256) ||
      expert.classification !== "OPTIONAL_EXTERNAL" ||
      expert.activation !== "EXPLICIT_ONLY" ||
      expert.authority !== "ADVISORY" ||
      expert.bundled !== false ||
      !Array.isArray(expert.modules) ||
      expert.modules.length === 0 ||
      expert.modules.some((slug) => !["frontend", "ui", "ux"].includes(slug)) ||
      !Array.isArray(expert.constraints) ||
      expert.constraints.length < 3
    )
      throw new Error(`Invalid optional external expert: ${expert?.id ?? "unknown"}`);
    ids.add(expert.id);
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
  if (hints.length === 0)
    return "- None; use detected project commands and direct manual evidence.";
  return hints.map((name) => `- \`${name}\``).join("\n");
}

function renderProcedure(steps) {
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function renderFrontendSystem(slug) {
  const entry = frontendSystem.areas[slug];
  if (entry === undefined) return "";
  const commands = entry.commands.map((mode) => `\`$forge ${slug} ${mode}\``).join(", ");
  const referenceRows = entry.references
    .map(
      (id) =>
        `- \`${id}\` — load the installed bundle file \`fullstack-forge/references/frontend/${id}.md\` only when its **Load when** condition matches; obey its **Do not load when** exclusions.`
    )
    .join("\n");
  return `
## Experience workflow and progressive references

Automatic activation signals include:

${list(entry.signals)}

Explicit agent shortcuts are ${commands}. \`review\` routes to evidence-preserving \`audit\`;
\`improve\` routes to a fix preview unless safe application is explicitly authorized. Normal feature
requests do not require a command.

Use this proportional workflow: ${frontendSystem.workflow.map((stage) => `\`${stage}\``).join(" → ")}.
For a small bounded change, keep the same order but record decisions inline; optional templates must
not become ceremony.

Load only the references selected by the request and repository evidence:

${referenceRows}

Accessibility rules remain owned by \`forge-accessibility\`; localization by \`forge-i18n\`;
performance proof by \`forge-performance\`; public-search behavior by \`forge-seo\`. Compose those
owners instead of copying their rules here. Never load mobile, chart, motion, or framework guidance
without matching evidence.
${renderExternalExperts(slug)}
`;
}

function renderExternalExperts(slug) {
  const experts = externalExperts.experts.filter((expert) => expert.modules.includes(slug));
  if (experts.length === 0) return "";
  const entries = experts
    .map(
      (expert) =>
        `- **${expert.displayName}** is not bundled and is never automatic. Only when the user explicitly names it, use a separately installed copy pinned to \`${expert.revision}\` (\`${expert.sha256}\`). Preserve its upstream workflow instead of paraphrasing it, run it in isolated read-only advisory context, and apply these boundaries: ${expert.constraints.join(" ")}`
    )
    .join("\n");
  return `

### Explicit external experts

${entries}

If the host cannot verify or load the pinned external skill, record the advisory as
\`NOT_VERIFIED\`; never download it during task execution. Resolve and read
\`../fullstack-forge/references/shared/external-experts.md\` relative to this module skill for the
portable precedence contract. The package's \`docs/EXTERNAL_EXPERTS.md\` contains user installation
guidance.
`;
}

function renderModule(module, criteria, procedure) {
  const name = `forge-${module.slug}`;
  return `---
name: ${name}
description: ${JSON.stringify(module.purpose)}
---

# ${name}: ${module.title}

${renderEngineBadge(module.slug)}

## Purpose

${module.purpose}

${renderCompositionRuntime(module.slug)}

Resolve and read \`../fullstack-forge/references/shared/module-contract.md\` (applicability,
execution, mutation, verification, completion) and
\`../fullstack-forge/references/shared/evidence-rules.md\` (statuses, standards, tools, findings via
\`../fullstack-forge/references/PROTOCOL.md\`) relative to this module \`SKILL.md\` before reporting.

Never hide failed checks or claim that an operation ran when it did not.

## Automatic activation signals

Activate when a request or direct repository evidence involves ${module.title.toLowerCase()}, when
the user explicitly names \`${name}\`, or when discovery proves an applicable boundary.

${list(module.applies)}

## When not to activate

${list(module.notApplies)}

## Automated support

Relevant discovery inputs are:

${list(module.inputs)}

Deterministic support, bounded evidence only:

${renderToolHints(module.slug)}${renderUiCommands(module.slug)}${renderFrontendSystem(module.slug)}

## Agent inspection procedure

${renderProcedure(procedure)}

Manual inspection requirements:

${list(module.manual)}

Stack-specific guidance:

${list(module.stack)}

## Evidence to collect

Standards used as criteria:

${list(module.standards)}

## Common production failures

${list(module.checks)}

## Missing-control checks

Each item needs direct evidence or one reasoned status.

${list(criteria)}

## Commands and tools

- Run \`forge ${module.slug} audit --json\` or \`fullstack-forge ${module.slug} audit --json\` when
  an explicit audit is requested and the CLI is installed. Normal feature work does not require it.

## Safe fixes

${list(module.safeFixes)}

## Approval-required changes

${list(module.approval)}

## Verification

${list(module.verify)}

## Completion contract

Follow \`fullstack-forge/references/shared/completion.md\` and the limitations below.

## Known limitations

${list(module.limitations)}
`;
}
