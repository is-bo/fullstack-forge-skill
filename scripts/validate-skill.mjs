import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expectedSlugs, platformTargets, projectRoot } from "./project.mjs";

const errors = [];
const requiredHeadings = [
  "## Purpose",
  "## Trigger conditions",
  "## When it applies",
  "## When it does not apply",
  "## Inputs from project discovery",
  "## Inspection procedure",
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
const slugs = catalog.map((entry) => entry.slug);
if (JSON.stringify(slugs) !== JSON.stringify(expectedSlugs))
  errors.push("Module catalog does not match the authoritative ordered set");
const masterPath = join(projectRoot, "src", "fullstack-forge", "SKILL.md");
await validateSkill(masterPath, "fullstack-forge", false);
for (const slug of expectedSlugs) {
  await validateSkill(
    join(projectRoot, "src", "fullstack-forge", "commands", `forge-${slug}`, "SKILL.md"),
    `forge-${slug}`,
    true
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
        entry.isDirectory() && (entry.name === "fullstack-forge" || entry.name.startsWith("forge-"))
    )
    .map((entry) => entry.name)
    .sort();
  const expected = ["fullstack-forge", ...expectedSlugs.map((slug) => `forge-${slug}`)].sort();
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
    `Validated 43 canonical skills, 6 generated platform roots, schemas, and interface metadata.`
  );
}

async function validateSkill(path, expectedName, command) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    errors.push(`${path}: missing (${error.message})`);
    return;
  }
  const lines = content.split(/\r?\n/u);
  if (lines.length > 500)
    errors.push(`${path}: ${lines.length} lines exceeds the 500-line guidance`);
  const frontmatter = parseSkillFrontmatter(content);
  if (frontmatter === null)
    errors.push(`${path}: frontmatter must contain only ordered name and description fields`);
  else {
    if (frontmatter.name !== expectedName) errors.push(`${path}: expected name ${expectedName}`);
    if (frontmatter.description.length === 0 || frontmatter.description.length > 1024)
      errors.push(`${path}: description must be 1-1024 characters`);
  }
  if (/\bTODO\b|\[TODO/iu.test(content)) errors.push(`${path}: unresolved TODO placeholder`);
  if (!content.includes("Never hide failed checks or claim that an operation ran when it did not."))
    errors.push(`${path}: missing completion contract`);
  if (command)
    for (const heading of requiredHeadings)
      if (!content.includes(heading)) errors.push(`${path}: missing ${heading}`);
}

function parseSkillFrontmatter(content) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(content)?.[1];
  if (block === undefined) return null;
  const lines = block.split(/\r?\n/u);
  const name = /^name:\s*(\S.*)$/u.exec(lines[0] ?? "")?.[1]?.trim();
  const descriptionStart = /^description:\s*(.*)$/u.exec(lines[1] ?? "")?.[1] ?? null;
  const continuation = lines.slice(2);
  if (
    name === undefined ||
    descriptionStart === null ||
    continuation.some((line) => line.length > 0 && !/^\s+/u.test(line))
  )
    return null;
  const description = [descriptionStart, ...continuation.map((line) => line.trim())]
    .filter(Boolean)
    .join(" ")
    .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/u, "$1$2")
    .trim();
  return { name, description };
}
