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
  if (!Array.isArray(config?.commands) || config.commands.length !== 23)
    throw new Error("config/ui-commands.json must declare exactly the 23 public Forge UI commands");
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
`;
}

function renderModule(module, criteria, procedure) {
  const name = `forge-${module.slug}`;
  return `---
name: ${name}
description: ${module.purpose} Activate automatically for ${module.applies[0].toLowerCase()} when that concern is relevant to a software-engineering request.
---

# ${name}: ${module.title}

${renderEngineBadge(module.slug)}

## Purpose

${module.purpose}

Read \`fullstack-forge/references/shared/module-contract.md\` (applicability, execution, mutation,
verification, completion) and \`fullstack-forge/references/shared/evidence-rules.md\` (statuses,
standards, tools, findings via \`fullstack-forge/references/PROTOCOL.md\`) before reporting.

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
