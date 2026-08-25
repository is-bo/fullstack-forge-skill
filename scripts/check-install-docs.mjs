import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";

/**
 * Guards against presenting an installation command that does not work today.
 *
 * Fullstack Forge is not published to the npm registry, so `npm install fullstack-forge-skill`
 * resolves to something the project does not control. Documentation may describe that command as a
 * future form, but only when the surrounding fenced block marks it unavailable. Every other
 * documented npm installation must name a credential-free immutable release specifier. A current
 * candidate may show its exact future GitHub Release asset only when the command block explicitly
 * marks that asset unavailable until publication.
 */

const REGISTRY_INSTALL = /^\s*npm\s+(?:install|i|add)\b[^\n]*?fullstack-forge-skill\b/u;
const UNPINNED_NPX_FORGE = /^\s*npx\s+forge(?:\s|$)/u;
const UNAVAILABLE_MARKER = /NOT YET AVAILABLE/u;
const RELEASE_SPECIFIER =
  /(?:https:\/\/codeload\.github\.com\/is-bo\/fullstack-forge-skill\/tar\.gz\/refs\/tags\/v\d+\.\d+\.\d+|https:\/\/github\.com\/is-bo\/fullstack-forge-skill\/releases\/download\/(v\d+\.\d+\.\d+)\/fullstack-forge-skill-\1\.tgz)/u;
const LEGACY_PROJECT_PIN =
  /https:\/\/codeload\.github\.com\/is-bo\/fullstack-forge-skill\/tar\.gz\/refs\/tags\/(v\d+\.\d+\.\d+)/gu;
const MODERN_PROJECT_PIN =
  /https:\/\/github\.com\/is-bo\/fullstack-forge-skill\/releases\/download\/(v\d+\.\d+\.\d+)\/fullstack-forge-skill-\1\.tgz/gu;
const MODERN_RELEASE_BUNDLE_MINIMUM = "0.2.3";

const { version } = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
const currentTag = `v${version}`;
const releaseProcess = await readFile(join(projectRoot, "docs", "RELEASE.md"), "utf8");
const historicalInstallTags = new Set(
  [
    ...releaseProcess.matchAll(/`(v\d+\.\d+\.\d+)` is a tagged but unpublished historical state/gu)
  ].map((match) => match[1])
);
const publicReleaseTags = new Set(
  [
    ...releaseProcess.matchAll(
      /`(v\d+\.\d+\.\d+)` is\s+(?:the\s+)?current\s+immutable\s+public\s+release/gu
    )
  ].map((match) => match[1])
);
const permittedProjectPins = new Set([currentTag, ...historicalInstallTags, ...publicReleaseTags]);
const currentUsesModernBundle = compareVersions(version, MODERN_RELEASE_BUNDLE_MINIMUM) >= 0;
const currentModernSpecifier =
  `https://github.com/is-bo/fullstack-forge-skill/releases/download/${currentTag}/` +
  `fullstack-forge-skill-${currentTag}.tgz`;

async function markdownFiles() {
  const files = [
    join(projectRoot, "README.md"),
    join(projectRoot, "examples", "quickstart-demo", "README.md")
  ];
  const docs = join(projectRoot, "docs");
  for (const entry of await readdir(docs, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(join(docs, entry.name));
  }
  return files;
}

const errors = [];
const inspected = [];
for (const path of await markdownFiles()) {
  const content = await readFile(path, "utf8");
  const relative = path
    .slice(projectRoot.length + 1)
    .split("\\")
    .join("/");
  inspected.push(relative);
  const blocks = [...content.matchAll(/```(?:bash|sh|shell)\n([\s\S]*?)```/gu)];
  for (const [, body] of blocks) {
    for (const line of body.split("\n")) {
      if (UNPINNED_NPX_FORGE.test(line))
        errors.push(
          `${relative}: uses unpinned 'npx forge'; require a local Fullstack Forge package with 'npx --no-install forge'`
        );
      if (
        !publicReleaseTags.has(currentTag) &&
        line.includes(currentModernSpecifier) &&
        !UNAVAILABLE_MARKER.test(body)
      )
        errors.push(
          `${relative}: presents the unpublished ${currentTag} release asset without a NOT YET AVAILABLE marker`
        );
      if (!REGISTRY_INSTALL.test(line)) continue;
      if (RELEASE_SPECIFIER.test(line)) continue;
      if (UNAVAILABLE_MARKER.test(body)) continue;
      errors.push(
        `${relative}: presents an unpublished registry install as usable: ${line.trim()}`
      );
    }
  }
  // Version-pinned install commands drift silently when a release bumps the tag. Outside
  // version-stamped historical records, every project release pin must match package.json.
  if (!/_v\d+\.\d+\.\d+\.md$/u.test(relative)) {
    const legacyPins = [...content.matchAll(LEGACY_PROJECT_PIN)].map((match) => ({
      tag: match[1],
      transport: "legacy"
    }));
    const modernPins = [...content.matchAll(MODERN_PROJECT_PIN)].map((match) => ({
      tag: match[1],
      transport: "modern"
    }));
    for (const { tag, transport } of [...legacyPins, ...modernPins]) {
      if (!permittedProjectPins.has(tag)) {
        errors.push(
          `${relative}: install pin ${tag} is stale; permitted tags are ${[...permittedProjectPins].join(", ")}`
        );
      }
      if (tag === currentTag && currentUsesModernBundle && transport !== "modern")
        errors.push(
          `${relative}: current install pin ${tag} must use its exact GitHub Release package artifact`
        );
    }
  }
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ valid: true, inspected: inspected.length }, null, 2));
}
