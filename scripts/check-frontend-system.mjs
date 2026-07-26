import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";

const errors = [];
const config = JSON.parse(
  await readFile(join(projectRoot, "config", "frontend-system.json"), "utf8")
);
const expectedReferences = [
  "product-and-ux",
  "visual-direction",
  "design-system",
  "responsive-layout",
  "accessibility-integration",
  "component-architecture",
  "react-nextjs",
  "frontend-performance",
  "motion-and-interactions",
  "forms-and-data-entry",
  "dashboards-and-data-visualization",
  "mobile-react-native",
  "design-review",
  "anti-patterns"
];
const referenceRoot = join(projectRoot, ...config.referenceRoot.split("/"));
const actualReferences = (await readdir(referenceRoot))
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.slice(0, -3))
  .sort();
if (JSON.stringify(actualReferences) !== JSON.stringify([...expectedReferences].sort()))
  errors.push("Canonical frontend reference set is incomplete or has competing extras");

const seenBullets = new Map();
for (const id of expectedReferences) {
  const relative = `${config.referenceRoot}/${id}.md`;
  const content = await readFile(join(projectRoot, ...relative.split("/")), "utf8");
  for (const heading of ["Owner:", "## Load when", "## Do not load when"])
    if (!content.includes(heading)) errors.push(`${relative}: missing '${heading}'`);
  for (const raw of content.split(/\r?\n/u)) {
    if (!raw.startsWith("- ") || raw.length < 70) continue;
    const normalized = raw.toLowerCase().replace(/[`*_]/gu, "").replace(/\s+/gu, " ").trim();
    const prior = seenBullets.get(normalized);
    if (prior !== undefined)
      errors.push(`${relative}: duplicates actionable guidance from ${prior}: '${raw}'`);
    else seenBullets.set(normalized, relative);
  }
}

const areas = Object.keys(config.areas);
if (JSON.stringify(areas) !== JSON.stringify(["frontend", "ui", "ux"]))
  errors.push("Frontend system must keep exactly the frontend, ui, and ux routing owners");
for (const [area, entry] of Object.entries(config.areas)) {
  for (const id of entry.references)
    if (!expectedReferences.includes(id)) errors.push(`${area}: unknown reference '${id}'`);
  if (new Set(entry.references).size !== entry.references.length)
    errors.push(`${area}: duplicate progressive reference`);
}
if (
  JSON.stringify(config.workflow) !==
  JSON.stringify([
    "UNDERSTAND",
    "INSPECT",
    "SELECT",
    "DEFINE",
    "IMPLEMENT",
    "RENDER",
    "VALIDATE",
    "REFINE",
    "REPORT"
  ])
)
  errors.push("Frontend operational workflow is incomplete or reordered");

for (const template of config.templates)
  try {
    await readFile(join(projectRoot, ...template.split("/")));
  } catch {
    errors.push(`Missing frontend template: ${template}`);
  }

const orchestratorPath = join(
  projectRoot,
  "src",
  "fullstack-forge",
  "commands",
  "forge-frontend",
  "SKILL.md"
);
const orchestrator = await readFile(orchestratorPath, "utf8");
const lineCount = orchestrator.split(/\r?\n/u).length;
if (lineCount < 150 || lineCount > 300)
  errors.push(`Frontend orchestrator must stay between 150 and 300 lines; found ${lineCount}`);
for (const id of expectedReferences)
  if (!orchestrator.includes(`references/frontend/${id}.md`))
    errors.push(`Frontend orchestrator does not route '${id}'`);

const scenarioTests = await readFile(
  join(projectRoot, "cli", "tests", "frontend-routing.test.ts"),
  "utf8"
);
const scenarioCount = (scenarioTests.match(/request:/gu) ?? []).length;
if (scenarioCount < 19)
  errors.push(
    `Expected at least 18 scenario requests plus the type declaration; found ${scenarioCount}`
  );
for (const phrase of [
  "database table schema",
  "API page size",
  "backend form parser",
  "React appointments table",
  "responsive booking page",
  "Next.js appointment component",
  "plain HTML interface",
  "Explicit frontend"
])
  if (!scenarioTests.toLowerCase().includes(phrase.toLowerCase()))
    errors.push(`Frontend routing regressions do not cover '${phrase}'`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${expectedReferences.length} canonical frontend references, 3 templates, 3 owners, and at least 18 scenarios.`
  );
}
