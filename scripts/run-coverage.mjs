import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { enforceCoverage, parseNodeCoverage } from "./lib/coverage.mjs";
import { projectRoot } from "./project.mjs";

const execute = promisify(execFile);
const thresholds = JSON.parse(
  await readFile(join(projectRoot, "config", "coverage-thresholds.json"), "utf8")
);
let result;
try {
  result = await execute(
    process.execPath,
    [
      "--test",
      "--experimental-test-coverage",
      "build/cli/tests/**/*.test.js",
      "scripts/tests/**/*.test.mjs"
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 20 * 60_000,
      maxBuffer: 20 * 1024 * 1024
    }
  );
} catch (error) {
  process.stdout.write(error.stdout ?? "");
  process.stderr.write(error.stderr ?? error.message);
  process.exitCode = typeof error.code === "number" ? error.code : 1;
  process.exit();
}
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
const report = parseNodeCoverage(`${result.stdout}\n${result.stderr}`);
enforceCoverage(report, thresholds);
console.log(
  `Coverage thresholds passed: lines ${report.overall.lines.toFixed(2)}%, branches ${report.overall.branches.toFixed(2)}%, functions ${report.overall.functions.toFixed(2)}%.`
);
