import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const testRoots = [join(root, "build", "cli", "tests"), join(root, "scripts", "tests")];
const files = [];

for (const directory of testRoots) await collect(directory);
files.sort();
if (files.length === 0) throw new Error("No compiled or script tests were found.");

const child = spawn(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
  shell: false
});
child.on("error", (error) => {
  throw error;
});
const exitCode = await new Promise((resolve) => child.on("exit", resolve));
process.exitCode = typeof exitCode === "number" ? exitCode : 1;

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile() && /\.test\.(?:js|mjs)$/u.test(entry.name))
      files.push(relative(root, path));
  }
}
