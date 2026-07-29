import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export async function collectTestFiles(root) {
  const files = [];
  for (const directory of [join(root, "build", "cli", "tests"), join(root, "scripts", "tests")])
    await collect(directory, root, files);
  files.sort();
  if (files.length === 0) throw new Error("No compiled or script tests were found.");
  return files;
}

async function collect(directory, root, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path, root, files);
    else if (entry.isFile() && /\.test\.(?:js|mjs)$/u.test(entry.name))
      files.push(relative(root, path));
  }
}
