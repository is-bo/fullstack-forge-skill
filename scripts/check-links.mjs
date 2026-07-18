import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { projectRoot } from "./project.mjs";

const markdown = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
  { cwd: projectRoot, encoding: "utf8", windowsHide: true, maxBuffer: 20 * 1024 * 1024 }
)
  .split(/\r?\n/u)
  .filter(Boolean)
  .sort();
const errors = [];
let references = 0;
for (const file of markdown) {
  const absolute = join(projectRoot, ...file.split("/"));
  const content = await readFile(absolute, "utf8");
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1]?.trim() ?? "";
    if (isExternal(target)) continue;
    references += 1;
    await checkTarget(file, absolute, target, match.index ?? 0, content);
  }
  for (const match of content.matchAll(/<img\s+([^>]+)>/giu)) {
    const attributes = match[1] ?? "";
    const source = /\bsrc=["']([^"']+)["']/iu.exec(attributes)?.[1];
    const alt = /\balt=["']([^"']*)["']/iu.exec(attributes)?.[1];
    if (source === undefined)
      errors.push(location(file, content, match.index ?? 0, "image has no src"));
    else if (!isExternal(source)) {
      references += 1;
      await checkTarget(file, absolute, source, match.index ?? 0, content);
    }
    if (alt === undefined || alt.trim().length === 0)
      errors.push(location(file, content, match.index ?? 0, "image has no useful alt text"));
  }
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({ valid: true, markdown_files: markdown.length, references }, null, 2)
  );
}

async function checkTarget(file, source, rawTarget, index, content) {
  const pathPart = rawTarget.replace(/^<|>$/gu, "").split("#", 1)[0]?.split("?", 1)[0] ?? "";
  if (pathPart.length === 0) return;
  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    errors.push(location(file, content, index, `invalid URL encoding in ${rawTarget}`));
    return;
  }
  if (isAbsolute(decoded)) {
    errors.push(
      location(file, content, index, `absolute local link is not portable: ${rawTarget}`)
    );
    return;
  }
  const target = resolve(dirname(source), decoded);
  const rel = relative(projectRoot, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    errors.push(location(file, content, index, `link escapes repository: ${rawTarget}`));
    return;
  }
  try {
    await access(target);
  } catch {
    errors.push(location(file, content, index, `missing local target: ${rawTarget}`));
  }
}

function isExternal(target) {
  return /^(?:https?:|mailto:|#)/iu.test(target);
}

function location(file, content, index, message) {
  return `${file}:${content.slice(0, index).split("\n").length}: ${message}`;
}
