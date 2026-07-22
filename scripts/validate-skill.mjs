import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildRequiredHeadings } from "./lib/build-generator.mjs";
import { collectSkillErrors } from "./lib/skill-validation.mjs";
import { expectedBuildCommands, expectedSlugs, platformTargets, projectRoot } from "./project.mjs";

const errors = [];
const requiredHeadings = [
  "## Purpose",
  "## Trigger conditions",
  "## When it applies",
  "## When it does not apply",
  "## Inputs from project discovery",
  "## Inspection procedure",
  "## Required inspection criteria",
  "## Safe executable checks",
  "## Manual inspection requirements",
  "## Evidence requirements",
  "## Finding identifiers and severity",
  "## Safe automatic fixes",
  "## Risky changes requiring approval",
  "## Verification procedure",
  "## Report fields",
  "## Primary standards",
  "## Stack-specific guidance",
  "## Known limitations",
  "## Completion contract"
];
const catalog = JSON.parse(await readFile(join(projectRoot, "config", "modules.json"), "utf8"));
const criteriaBySlug = JSON.parse(
  await readFile(join(projectRoot, "config", "module-criteria.json"), "utf8")
);
const slugs = catalog.map((entry) => entry.slug);
if (JSON.stringify(slugs) !== JSON.stringify(expectedSlugs))
  errors.push("Module catalog does not match the authoritative ordered set");
if (
  typeof criteriaBySlug !== "object" ||
  criteriaBySlug === null ||
  Array.isArray(criteriaBySlug) ||
  JSON.stringify(Object.keys(criteriaBySlug)) !== JSON.stringify(expectedSlugs)
)
  errors.push("Inspection criteria do not match the authoritative ordered module set");
const masterPath = join(projectRoot, "src", "fullstack-forge", "SKILL.md");
await validateSkill(masterPath, "fullstack-forge", false);
for (const slug of expectedSlugs) {
  const criteria =
    typeof criteriaBySlug === "object" && criteriaBySlug !== null && !Array.isArray(criteriaBySlug)
      ? criteriaBySlug[slug]
      : undefined;
  if (
    !Array.isArray(criteria) ||
    criteria.length === 0 ||
    criteria.some(
      (value) =>
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value !== value.trim() ||
        /[\r\n]/u.test(value)
    ) ||
    new Set(criteria).size !== criteria.length
  ) {
    errors.push(`Invalid or duplicate inspection criteria for ${slug}`);
    continue;
  }
  await validateSkill(
    join(projectRoot, "src", "fullstack-forge", "commands", `forge-${slug}`, "SKILL.md"),
    `forge-${slug}`,
    true,
    criteria
  );
}
for (const name of expectedBuildCommands) {
  await validateSkill(
    join(projectRoot, "src", "fullstack-forge", "commands", name, "SKILL.md"),
    name,
    true,
    [],
    buildRequiredHeadings
  );
}
for (const path of [
  "skill.json",
  "src/fullstack-forge/schemas/finding.schema.json",
  "src/fullstack-forge/schemas/project-profile.schema.json",
  "src/fullstack-forge/schemas/skill.schema.json"
]) {
  try {
    JSON.parse(await readFile(join(projectRoot, ...path.split("/")), "utf8"));
  } catch (error) {
    errors.push(`${path}: invalid or missing JSON (${error.message})`);
  }
}
const openaiYaml = await readFile(
  join(projectRoot, "src", "fullstack-forge", "agents", "openai.yaml"),
  "utf8"
);
if (!/^\s+display_name:\s+"Fullstack Forge"\s*$/mu.test(openaiYaml))
  errors.push("agents/openai.yaml display_name must be quoted");
const short = /^\s+short_description:\s+"([^"]+)"\s*$/mu.exec(openaiYaml)?.[1] ?? "";
if (short.length < 25 || short.length > 64)
  errors.push("agents/openai.yaml short_description must be 25-64 characters");
if (!/^\s+default_prompt:\s+"[^"]*\$fullstack-forge[^"]*"\s*$/mu.test(openaiYaml))
  errors.push("agents/openai.yaml default_prompt must explicitly mention $fullstack-forge");

for (const platform of platformTargets) {
  const root = join(projectRoot, ...platform.path.split("/"));
  const entries = await readdir(root, { withFileTypes: true });
  const skills = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (entry.name === "fullstack-forge" ||
          entry.name === "forge" ||
          entry.name.startsWith("forge-"))
    )
    .map((entry) => entry.name)
    .sort();
  const expected = [
    "fullstack-forge",
    ...expectedSlugs.map((slug) => `forge-${slug}`),
    ...expectedBuildCommands
  ].sort();
  if (JSON.stringify(skills) !== JSON.stringify(expected))
    errors.push(`${platform.id}: generated skill directory set is incomplete or has extras`);
}

const required = [
  "README.md",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "docs/COMMANDS.md",
  "docs/ARCHITECTURE.md",
  "docs/PLATFORM_SUPPORT.md",
  "docs/FINDING_SCHEMA.md",
  "docs/SECURITY_MODEL.md",
  "docs/ADDING_A_MODULE.md",
  "docs/ADDING_A_PLATFORM.md",
  "docs/RELEASING.md",
  "docs/IMAGE_GENERATION_BRIEF.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/audit_module.yml",
  ".github/pull_request_template.md",
  "research/SOURCES.md",
  "research/LICENSE_MATRIX.md"
];
for (const path of required) {
  try {
    await readFile(join(projectRoot, ...path.split("/")));
  } catch {
    errors.push(`Missing required repository file: ${path}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated 46 canonical skills, 6 generated platform roots, schemas, and interface metadata.`
  );
}

async function validateSkill(
  path,
  expectedName,
  command,
  criteria = [],
  headings = requiredHeadings
) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    errors.push(`${path}: missing (${error.message})`);
    return;
  }
  errors.push(...collectSkillErrors(path, content, { expectedName, command, criteria, headings }));
}
