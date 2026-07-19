import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateWorkflowPolicies } from "./lib/workflow-policy.mjs";
import { projectRoot } from "./project.mjs";

const root = join(projectRoot, ".github", "workflows");
const names = (await readdir(root)).filter((name) => /\.ya?ml$/iu.test(name)).sort();
const workflows = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await readFile(join(root, name), "utf8")]))
);
const errors = validateWorkflowPolicies(workflows);
if (errors.length > 0) throw new Error(`Unsafe workflow policy:\n${errors.join("\n")}`);
console.log(
  `Validated ${names.length} workflows: immutable SHA pins and release safety policy pass.`
);
