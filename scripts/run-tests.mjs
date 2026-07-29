import { spawn } from "node:child_process";
import { collectTestFiles } from "./lib/test-files.mjs";

const root = process.cwd();
const files = await collectTestFiles(root);

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
