import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildRequiredHeadings } from "./lib/build-generator.mjs";
import { collectSkillErrors } from "./lib/skill-validation.mjs";
import { expectedBuildCommands, expectedSlugs, platformTargets, projectRoot } from "./project.mjs";

const errors = [];
const requiredHeadings = [
  "## Purpose",
  "## Automatic activation signals",
  "## When not to activate",
  "## Automated support",
  "## Agent inspection procedure",
  "## Evidence to collect",
  "## Common production failures",
  "## Missing-control checks",
  "## Commands and tools",
  "## Safe fixes",
  "## Approval-required changes",
  "## Verification",
  "## Completion contract",
  "## Known limitations"
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
validateOpenAiMetadata("src/fullstack-forge/agents/openai.yaml", openaiYaml, {
  displayName: "Fullstack Forge — Agent-first Engineering",
  shortDescription: "Automatic production engineering for app changes",
  skillMention: "$fullstack-forge",
  promptTerms: ["automatically", "proportional", "optional"]
});

const forgeOpenaiPath = join(
  projectRoot,
  "src",
  "fullstack-forge",
  "commands",
  "forge",
  "agents",
  "openai.yaml"
);
const forgeOpenaiYaml = await readFile(forgeOpenaiPath, "utf8");
validateOpenAiMetadata("src/fullstack-forge/commands/forge/agents/openai.yaml", forgeOpenaiYaml, {
  displayName: "Forge",
  shortDescription: "Automatic Build · Fix · Verify · Ship guidance",
  skillMention: "$forge",
  promptTerms: [
    "build",
    "continue",
    "audit",
    "fix",
    "verify",
    "ship",
    "status",
    "help",
    "automatically",
    "proportional agent-first workflow",
    "optional overrides"
  ]
});
const canonicalIcon = await readFile(
  join(projectRoot, "src", "fullstack-forge", "assets", "fullstack-forge-icon.png")
);
const forgeIcon = await readFile(
  join(
    projectRoot,
    "src",
    "fullstack-forge",
    "commands",
    "forge",
    "assets",
    "fullstack-forge-icon.png"
  )
);
if (!canonicalIcon.equals(forgeIcon))
  errors.push("Forge picker icon must match the canonical Fullstack Forge icon");

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

function validateOpenAiMetadata(relativePath, yaml, expected) {
  const topLevelKeys = yaml
    .split(/\r?\n/u)
    .filter((line) => /^[a-z_][a-z0-9_]*:/u.test(line))
    .map((line) => line.slice(0, line.indexOf(":")));
  if (JSON.stringify(topLevelKeys) !== JSON.stringify(["interface"]))
    errors.push(`${relativePath}: only the supported interface block is allowed`);

  const interfaceKeys = yaml
    .split(/\r?\n/u)
    .map((line) => /^ {2}([a-z_][a-z0-9_]*):/u.exec(line)?.[1])
    .filter(Boolean);
  const supportedKeys = [
    "display_name",
    "short_description",
    "icon_small",
    "icon_large",
    "brand_color",
    "default_prompt"
  ];
  if (JSON.stringify(interfaceKeys) !== JSON.stringify(supportedKeys))
    errors.push(`${relativePath}: interface fields must match the supported OpenAI schema`);

  const displayName = /^\s+display_name:\s+"([^"]+)"\s*$/mu.exec(yaml)?.[1] ?? "";
  const shortDescription = /^\s+short_description:\s+"([^"]+)"\s*$/mu.exec(yaml)?.[1] ?? "";
  const defaultPrompt =
    /^\s+default_prompt:\s*(?:"([^"]+)"|\r?\n\s+"([^"]+)")\s*$/mu
      .exec(yaml)
      ?.slice(1)
      .find(Boolean) ?? "";
  if (displayName !== expected.displayName)
    errors.push(`${relativePath}: display_name must be quoted as "${expected.displayName}"`);
  if (shortDescription !== expected.shortDescription)
    errors.push(`${relativePath}: short_description does not match the product preview`);
  if (shortDescription.length < 25 || shortDescription.length > 64)
    errors.push(`${relativePath}: short_description must be 25-64 characters`);
  if (!defaultPrompt.includes(expected.skillMention))
    errors.push(`${relativePath}: default_prompt must mention ${expected.skillMention}`);
  for (const term of expected.promptTerms ?? []) {
    if (!defaultPrompt.toLowerCase().includes(term))
      errors.push(`${relativePath}: default_prompt must include '${term}'`);
  }
  if (!/^\s+icon_small:\s+"\.\/assets\/fullstack-forge-icon\.png"\s*$/mu.test(yaml))
    errors.push(`${relativePath}: icon_small must use the bundled Forge icon`);
  if (!/^\s+icon_large:\s+"\.\/assets\/fullstack-forge-icon\.png"\s*$/mu.test(yaml))
    errors.push(`${relativePath}: icon_large must use the bundled Forge icon`);
  if (!/^\s+brand_color:\s+"#2563EB"\s*$/mu.test(yaml))
    errors.push(`${relativePath}: brand_color must be #2563EB`);
}
