import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";

const configuration = JSON.parse(
  await readFile(join(projectRoot, "config", "repository-identity.json"), "utf8")
);
const owner = configuration.canonical_owner;
const repository = configuration.canonical_repository;
const migrationDocumentation = new Map(Object.entries(configuration.migration_documentation ?? {}));
const compatibilityAllowlist = new Set(configuration.compatibility_allowlist ?? []);
const legacyOwner = "the" + "thunderbolt";
const errors = [];

if (owner !== "is-bo" || repository !== "is-bo/fullstack-forge-skill")
  errors.push("Repository identity configuration must name is-bo/fullstack-forge-skill");
if (compatibilityAllowlist.size !== 0)
  errors.push("No legacy compatibility identifiers are currently required");
for (const [path, expected] of migrationDocumentation) {
  if (typeof expected !== "number" || expected < 1)
    errors.push(`Migration documentation count is invalid for ${path}`);
}

const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
const skill = JSON.parse(await readFile(join(projectRoot, "skill.json"), "utf8"));
const expectedRepositoryUrl = `git+https://github.com/${repository}.git`;
const expectedHomepage = `https://github.com/${repository}#readme`;
const expectedBugs = `https://github.com/${repository}/issues`;
if (packageJson.author !== owner) errors.push("package.json author is not the canonical owner");
if (packageJson.homepage !== expectedHomepage) errors.push("package.json homepage is incorrect");
if (packageJson.repository?.type !== "git" || packageJson.repository?.url !== expectedRepositoryUrl)
  errors.push("package.json repository metadata is incorrect");
if (packageJson.bugs?.url !== expectedBugs) errors.push("package.json bugs metadata is incorrect");
if (packageLock.packages?.[""]?.version !== packageJson.version)
  errors.push("package-lock.json root version does not match package.json");
if (skill.version !== packageJson.version)
  errors.push("skill.json version does not match package.json");

const readme = await readFile(join(projectRoot, "README.md"), "utf8");
for (const required of [
  `https://img.shields.io/github/v/release/${repository}`,
  `https://github.com/${repository}/actions/workflows/ci.yml/badge.svg`,
  `https://github.com/${repository}/releases`,
  `npm install --save-dev "git+https://github.com/${repository}.git#v${packageJson.version}"`
]) {
  if (!readme.includes(required))
    errors.push(`README.md is missing canonical identity: ${required}`);
}

const gettingStarted = await readFile(join(projectRoot, "docs", "GETTING_STARTED.md"), "utf8");
if (!gettingStarted.includes(`git+https://github.com/${repository}.git#v${packageJson.version}`))
  errors.push("Getting started installation example is not canonical");

const releaseWorkflow = await readFile(
  join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8"
);
if (!releaseWorkflow.includes("GITHUB_REPOSITORY"))
  errors.push("Release workflow must derive public URLs from GITHUB_REPOSITORY");

const generatedPrefixes = [
  ".agents/skills/",
  ".claude/skills/",
  ".cursor/skills/",
  ".gemini/skills/",
  ".github/skills/",
  ".windsurf/skills/"
];
const files = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024
  }
)
  .split("\0")
  .filter(Boolean)
  .sort();
const legacyCounts = new Map();
let generatedCanonicalReference = false;
for (const path of files) {
  let content;
  try {
    content = await readFile(join(projectRoot, ...path.split("/")));
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }
  const text = content.toString("utf8");
  const matches = text.match(new RegExp(legacyOwner, "giu"))?.length ?? 0;
  if (matches > 0) legacyCounts.set(path, matches);
  if (
    generatedPrefixes.some((prefix) => path.startsWith(prefix)) &&
    text.includes(`https://github.com/${repository}`)
  )
    generatedCanonicalReference = true;
}
if (!generatedCanonicalReference)
  errors.push("Generated Agent Skills contain no canonical public repository reference");
for (const [path, count] of legacyCounts) {
  const expected = migrationDocumentation.get(path);
  if (expected === undefined && !compatibilityAllowlist.has(path))
    errors.push(`Unexpected old-owner reference in ${path}`);
  else if (expected !== undefined && count !== expected)
    errors.push(
      `Migration documentation count changed in ${path}: expected ${expected}, found ${count}`
    );
}
for (const [path, expected] of migrationDocumentation) {
  if (legacyCounts.get(path) !== expected)
    errors.push(`Required migration documentation reference missing from ${path}`);
}

if (errors.length > 0)
  throw new Error(`Repository identity validation failed:\n${errors.join("\n")}`);
console.log(
  JSON.stringify(
    {
      valid: true,
      owner,
      repository,
      version: packageJson.version,
      generated_roots: generatedPrefixes.length,
      legacy_migration_references: Object.fromEntries(legacyCounts)
    },
    null,
    2
  )
);
