import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  adapterPointer,
  extractFrontmatter,
  readAdapterMarker,
  renderAdapter
} from "./lib/managed-layout.mjs";
import { projectRoot } from "./project.mjs";

const root = projectRoot;
const errors = [];
const manifestPath = join(root, ".codex-plugin", "plugin.json");
const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    errors.push(`${label} must be readable JSON (${error.message})`);
    return null;
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "")
    errors.push(`${label} must be a non-empty string`);
  return value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) errors.push(`${label} must be ${JSON.stringify(expected)}`);
}

function assertRelativeSkillPath(value) {
  if (typeof value !== "string" || !value.startsWith("./")) {
    errors.push("plugin.json skills must be a relative path beginning with ./");
    return null;
  }
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/u, "");
  const pathParts = normalized.slice(2).split("/").filter(Boolean);
  if (pathParts.includes("..") || pathParts.length === 0) {
    errors.push("plugin.json skills must stay inside the plugin package");
    return null;
  }
  return normalized;
}

const packageJson = await readJson(join(root, "package.json"), "package.json");
const plugin = await readJson(manifestPath, ".codex-plugin/plugin.json");
const marketplace = await readJson(marketplacePath, ".agents/plugins/marketplace.json");

if (packageJson !== null) {
  requireString(packageJson.name, "package.json name");
  requireString(packageJson.version, "package.json version");
  assertEqual(packageJson.license, "Apache-2.0", "package.json license");
  const files = Array.isArray(packageJson.files) ? packageJson.files : [];
  if (!files.some((path) => path === ".codex-plugin/" || path === ".codex-plugin"))
    errors.push("package.json files must publish .codex-plugin/");
  if (
    !files.some((path) => path === ".agents/" || path === ".agents" || path.startsWith(".agents/"))
  )
    errors.push("package.json files must publish the .agents/ adapters");
  if (!files.some((path) => path === "skills/" || path === "skills" || path.startsWith("skills/")))
    errors.push("package.json files must publish the Codex plugin skills/ adapters");
}

if (plugin !== null) {
  assertEqual(plugin.name, "fullstack-forge", "plugin.json name");
  requireString(plugin.version, "plugin.json version");
  requireString(plugin.description, "plugin.json description");
  assertEqual(plugin.license, "Apache-2.0", "plugin.json license");
  if (packageJson !== null) assertEqual(plugin.version, packageJson.version, "plugin.json version");
  const skillsPath = assertRelativeSkillPath(plugin.skills);
  if (skillsPath !== "./skills")
    errors.push("plugin.json skills must point at the existing thin skills/ adapters");
  if (plugin.interface?.displayName !== "Fullstack Forge")
    errors.push("plugin.json interface.displayName must be Fullstack Forge");
  if (plugin.interface?.category !== "Developer Tools")
    errors.push("plugin.json interface.category must be Developer Tools");
}

if (marketplace !== null) {
  assertEqual(marketplace.name, "fullstack-forge", "marketplace name");
  const entries = marketplace.plugins;
  if (!Array.isArray(entries) || entries.length !== 1) {
    errors.push("marketplace.json must contain exactly one Fullstack Forge plugin entry");
  } else {
    const entry = entries[0];
    assertEqual(entry.name, "fullstack-forge", "marketplace plugin name");
    assertEqual(entry.source?.source, "npm", "marketplace plugin source.source");
    if (packageJson !== null)
      assertEqual(entry.source?.package, packageJson.name, "marketplace npm package");
    if (packageJson !== null)
      assertEqual(entry.source?.version, packageJson.version, "marketplace npm version");
    if (entry.source?.path !== undefined)
      errors.push("npm marketplace entry must not include a duplicate local source.path");
    assertEqual(
      entry.policy?.installation,
      "NOT_AVAILABLE",
      "unpublished candidate marketplace installation policy"
    );
    assertEqual(entry.policy?.authentication, "ON_INSTALL", "marketplace authentication policy");
    assertEqual(entry.category, "Developer Tools", "marketplace category");
  }
}

const adaptersRoot = resolve(root, "skills");
const adaptersRelative = relative(root, adaptersRoot);
if (adaptersRelative.startsWith(`..${sep}`) || resolve(adaptersRoot) !== adaptersRoot) {
  errors.push("skills/ must resolve inside the repository");
} else {
  try {
    const rootStats = await stat(adaptersRoot);
    if (!rootStats.isDirectory()) errors.push("skills/ must be a directory");
    const entries = await readdir(adaptersRoot, { withFileTypes: true });
    const skillDirectories = entries.filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith(".")
    );
    if (skillDirectories.length === 0) errors.push("skills/ must contain thin skill adapters");
    for (const entry of skillDirectories) {
      const adapter = join(adaptersRoot, entry.name, "SKILL.md");
      try {
        const adapterStats = await stat(adapter);
        if (!adapterStats.isFile())
          errors.push(`missing adapter file: skills/${entry.name}/SKILL.md`);
        else await verifyThinAdapter(entry.name, adapter);
      } catch (error) {
        errors.push(`missing adapter file: skills/${entry.name}/SKILL.md (${error.message})`);
      }
    }
  } catch (error) {
    errors.push(`skills/ is not readable (${error.message})`);
  }
}

for (const skill of ["fullstack-forge", "forge"]) {
  const metadataPath = join(adaptersRoot, skill, "agents", "openai.yaml");
  const iconPath = join(adaptersRoot, skill, "assets", "fullstack-forge-icon.png");
  try {
    const metadata = await readFile(metadataPath, "utf8");
    if (!metadata.includes("./assets/fullstack-forge-icon.png"))
      errors.push(`skills/${skill}/agents/openai.yaml must reference its packaged icon`);
    const iconStats = await stat(iconPath);
    if (!iconStats.isFile()) errors.push(`skills/${skill} must package its Codex icon asset`);
  } catch (error) {
    errors.push(`skills/${skill} must package Codex UI metadata and assets (${error.message})`);
  }
}

async function verifyThinAdapter(skill, adapterPath) {
  let adapterText;
  try {
    adapterText = await readFile(adapterPath, "utf8");
  } catch (error) {
    errors.push(`skills/${skill}/SKILL.md is not readable (${error.message})`);
    return;
  }
  const marker = readAdapterMarker(adapterText);
  const canonical = join(root, ".fullstack-forge", "skills", skill, "SKILL.md");
  const pointer = adapterPointer("skills", skill);
  if (marker === undefined) {
    errors.push(`skills/${skill}/SKILL.md must be a generated thin adapter`);
    return;
  }
  if (marker.version !== 1 || marker.skill !== skill || marker.canonical !== pointer)
    errors.push(`skills/${skill}/SKILL.md has an invalid managed-adapter marker`);
  const resolved = resolve(adaptersRoot, skill, ...pointer.split("/"));
  const resolvedRelative = relative(root, resolved);
  if (resolvedRelative.startsWith(`..${sep}`) || resolvedRelative === "..")
    errors.push(`skills/${skill}/SKILL.md points outside the repository`);
  try {
    const canonicalText = await readFile(canonical, "utf8");
    const expected = renderAdapter({
      skill,
      pointer,
      frontmatter: extractFrontmatter(canonicalText, `${skill}/SKILL.md`)
    });
    if (adapterText !== expected)
      errors.push(
        `skills/${skill}/SKILL.md is not the deterministic thin adapter for its canonical playbook`
      );
  } catch (error) {
    errors.push(
      `skills/${skill}/SKILL.md canonical playbook is missing or invalid (${error.message})`
    );
  }
}

if (errors.length > 0)
  throw new Error(
    `Codex plugin validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`
  );

console.log(
  JSON.stringify(
    {
      valid: true,
      plugin: plugin.name,
      version: packageJson.version,
      npm_package: marketplace.plugins[0].source.package,
      adapter_root: "skills",
      adapter_count: (await readdir(adaptersRoot, { withFileTypes: true })).filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith(".")
      ).length
    },
    null,
    2
  )
);
