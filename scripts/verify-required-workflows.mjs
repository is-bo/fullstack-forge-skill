import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { verifyRequiredWorkflowRuns } from "./lib/required-workflows.mjs";

const runFile = promisify(execFile);
const { repository, sha, required, requiredPaths } = parseArguments(process.argv.slice(2));
let result;
try {
  result = await runFile(
    "gh",
    [
      "api",
      "--paginate",
      "--slurp",
      "-H",
      "X-GitHub-Api-Version: 2022-11-28",
      `repos/${repository}/actions/runs?head_sha=${sha}&event=push&per_page=100`
    ],
    { encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }
  );
} catch (error) {
  throw new Error("Exact-SHA required-workflow lookup failed; release is blocked", {
    cause: error
  });
}
let response;
try {
  response = JSON.parse(result.stdout);
} catch {
  throw new Error("Exact-SHA required-workflow lookup returned malformed JSON; release is blocked");
}
console.log(
  JSON.stringify(verifyRequiredWorkflowRuns(response, { sha, required, requiredPaths }), null, 2)
);

function parseArguments(args) {
  let repository;
  let sha;
  const required = [];
  const requiredPaths = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${flag} requires one value`);
    if (flag === "--repository" && repository === undefined) repository = value;
    else if (flag === "--sha" && sha === undefined) sha = value;
    else if (flag === "--required") required.push(value);
    else if (flag === "--required-path") {
      const separator = value.indexOf("=");
      const name = separator < 1 ? "" : value.slice(0, separator);
      const path = separator < 1 ? "" : value.slice(separator + 1);
      if (requiredPaths[name] !== undefined)
        throw new Error(`Unknown or repeated required-workflow argument: ${flag}`);
      requiredPaths[name] = path;
    } else throw new Error(`Unknown or repeated required-workflow argument: ${flag}`);
  }
  if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository))
    throw new Error("--repository must be an owner/repository identifier");
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/u.test(sha))
    throw new Error("--sha must be a full lowercase commit SHA");
  if (required.length === 0) throw new Error("At least one --required workflow name is required");
  for (const name of Object.keys(requiredPaths))
    if (!required.includes(name))
      throw new Error(`--required-path must identify a corresponding --required workflow: ${name}`);
  return { repository, sha, required, requiredPaths };
}
