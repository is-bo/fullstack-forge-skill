import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSymlinkPath, assertSafeRelativePath } from "./lib/fs-safety.mjs";
import {
  computeGuidanceCoverage,
  renderBrief,
  renderCommandSkill,
  validateCommandCatalog,
  validateGuidanceMap
} from "./lib/build-generator.mjs";
import {
  canonicalRoot,
  commandRoot,
  expectedBuildCommands,
  expectedSlugs,
  projectRoot
} from "./project.mjs";

const catalog = JSON.parse(
  await readFile(join(projectRoot, "config", "build-commands.json"), "utf8")
);
validateCommandCatalog(catalog, expectedBuildCommands);

await assertNoSymlinkPath(projectRoot, commandRoot);
await mkdir(commandRoot, { recursive: true });

for (const entry of catalog) {
  const directory = join(commandRoot, entry.name);
  await assertNoSymlinkPath(commandRoot, directory);
  await mkdir(directory, { recursive: true });
  const path = join(directory, "SKILL.md");
  await assertNoSymlinkPath(directory, path);
  const next = renderCommandSkill(entry);
  let current = "";
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current !== next) await writeFile(path, next, "utf8");
}

const forgeIconSource = join(canonicalRoot, "assets", "fullstack-forge-icon.png");
const forgeAssetRoot = join(commandRoot, "forge", "assets");
const forgeIconTarget = join(forgeAssetRoot, "fullstack-forge-icon.png");
await assertNoSymlinkPath(commandRoot, forgeAssetRoot);
await assertNoSymlinkPath(commandRoot, forgeIconTarget);
await mkdir(forgeAssetRoot, { recursive: true });
const forgeIcon = await readFile(forgeIconSource);
let currentForgeIcon;
try {
  currentForgeIcon = await readFile(forgeIconTarget);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (currentForgeIcon === undefined || !currentForgeIcon.equals(forgeIcon))
  await writeFile(forgeIconTarget, forgeIcon);

const guidance = JSON.parse(
  await readFile(join(projectRoot, "config", "build-guidance.json"), "utf8")
);
validateGuidanceMap(guidance, expectedSlugs);

const briefRoot = join(projectRoot, "src", "fullstack-forge", "references", "build");
await assertNoSymlinkPath(projectRoot, briefRoot);
await mkdir(briefRoot, { recursive: true });

const guidanceSlugs = new Set(Object.keys(guidance));
for (const [slug, entry] of Object.entries(guidance)) {
  const relName = `${slug}.md`;
  assertSafeRelativePath(relName, "build guidance brief path");
  const path = join(briefRoot, relName);
  await assertNoSymlinkPath(briefRoot, path);
  const next = renderBrief(slug, entry);
  let current = "";
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current !== next) await writeFile(path, next, "utf8");
}

const existingBriefs = await readdir(briefRoot, { withFileTypes: true });
for (const item of existingBriefs) {
  if (!item.isFile() || !item.name.endsWith(".md")) continue;
  const slug = item.name.slice(0, -3);
  if (guidanceSlugs.has(slug)) continue;
  const path = join(briefRoot, item.name);
  await assertNoSymlinkPath(briefRoot, path);
  await rm(path);
}

const coverage = computeGuidanceCoverage(guidance, expectedSlugs);
if (coverage.complete) {
  console.log(
    `Generated ${catalog.length} build command skills and ${coverage.presentCount}/${coverage.total} build guidance briefs (full coverage).`
  );
} else {
  console.log(
    `Generated ${catalog.length} build command skills and ${coverage.presentCount}/${coverage.total} build guidance briefs. ` +
      `Missing ${coverage.missing.length} brief(s), pending WS-B2: ${coverage.missing.join(", ")}.`
  );
}
