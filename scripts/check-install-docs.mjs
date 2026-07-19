import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";

/**
 * Guards against presenting an installation command that does not work today.
 *
 * Fullstack Forge is not published to the npm registry, so `npm install fullstack-forge-skill`
 * resolves to something the project does not control. Documentation may describe that command as a
 * future form, but only when the surrounding fenced block marks it unavailable. Every other
 * documented npm installation must name a Git specifier that resolves right now.
 */

const REGISTRY_INSTALL =
  /^\s*npm\s+(?:install|i|add)\b[^\n]*?(?<!github:thethunderbolt\/)fullstack-forge-skill\b/u;
const UNAVAILABLE_MARKER = /NOT YET AVAILABLE/u;
const GIT_SPECIFIER = /github:[^\s#]+#v\d+\.\d+\.\d+/u;

async function markdownFiles() {
  const files = [join(projectRoot, "README.md")];
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
      if (!REGISTRY_INSTALL.test(line)) continue;
      if (GIT_SPECIFIER.test(line)) continue;
      if (UNAVAILABLE_MARKER.test(body)) continue;
      errors.push(
        `${relative}: presents an unpublished registry install as usable: ${line.trim()}`
      );
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ valid: true, inspected: inspected.length }, null, 2));
}
