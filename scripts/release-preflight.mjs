import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertReleasePreconditions, assertUniqueAssetNames } from "./lib/release-safety.mjs";

const run = promisify(execFile);
const values = parseArguments(process.argv.slice(2));
const tag = required(values, "tag");
const expectedSha = required(values, "sha");
const repository = process.env.GITHUB_REPOSITORY;
if (repository === undefined || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository))
  throw new Error("GITHUB_REPOSITORY is required.");

const tagResult = await run("git", ["rev-list", "-n", "1", `${tag}^{commit}`], {
  encoding: "utf8",
  windowsHide: true
});
const tagSha = tagResult.stdout.trim();
let releaseState;
try {
  await run("gh", ["api", `repos/${repository}/releases/tags/${tag}`], {
    encoding: "utf8",
    windowsHide: true
  });
  releaseState = "exists";
} catch (error) {
  const message = `${error.stderr ?? ""}\n${error.message ?? ""}`;
  if (/HTTP 404|Not Found/iu.test(message)) releaseState = "missing";
  else throw new Error(`Could not prove release absence: ${message.trim()}`, { cause: error });
}
assertReleasePreconditions({ tag, expectedSha, tagSha, releaseState });
assertUniqueAssetNames(values.assets ?? []);
console.log(
  JSON.stringify({ tag, tagSha, releaseState, assetNames: values.assets ?? [] }, null, 2)
);

function parseArguments(args) {
  const result = { assets: [] };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--asset") {
      const asset = args[index + 1];
      if (asset === undefined) throw new Error("--asset requires a path.");
      result.assets.push(asset);
      index += 1;
    } else if (value === "--tag" || value === "--sha") {
      const next = args[index + 1];
      if (next === undefined) throw new Error(`${value} requires a value.`);
      result[value.slice(2)] = next;
      index += 1;
    } else throw new Error(`Unknown release-preflight argument '${value}'.`);
  }
  return result;
}

function required(values, name) {
  const value = values[name];
  if (typeof value !== "string" || value.length === 0) throw new Error(`--${name} is required.`);
  return value;
}
