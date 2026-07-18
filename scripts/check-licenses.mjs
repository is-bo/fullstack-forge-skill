import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./project.mjs";

const allowed = new Set([
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "ISC",
  "MIT"
]);
const lock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
const rejected = [];
let dependencies = 0;
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (path === "") continue;
  dependencies += 1;
  if (typeof entry.license !== "string" || !allowed.has(entry.license))
    rejected.push({ path, license: entry.license ?? "MISSING" });
}
if (lock.packages?.[""]?.license !== "Apache-2.0")
  rejected.push({ path: "<root>", license: lock.packages?.[""]?.license ?? "MISSING" });
if (rejected.length > 0) {
  console.error(JSON.stringify({ valid: false, rejected }, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({ valid: true, dependencies, allowed_licenses: [...allowed].sort() }, null, 2)
  );
}
