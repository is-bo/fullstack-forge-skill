import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  assertNoExistingAttestations,
  assertReleasePreconditions,
  assertUniqueAssetNames,
  classifyAttestationState,
  classifyReleaseState,
  digest
} from "./lib/release-safety.mjs";

const run = promisify(execFile);
const values = parseArguments(process.argv.slice(2));
const tag = required(values, "tag");
const expectedSha = required(values, "sha");
const version = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
).version;
if (typeof version !== "string") throw new Error("package.json has no release version.");
const repository = process.env.GITHUB_REPOSITORY;
if (repository === undefined || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository))
  throw new Error("GITHUB_REPOSITORY is required.");

const tagResult = await run("git", ["rev-list", "-n", "1", `${tag}^{commit}`], {
  encoding: "utf8",
  windowsHide: true
});
const tagSha = tagResult.stdout.trim();
// Tag-specific lookups can be draft-blind. Listing every page makes retries fail closed when an
// unpublished draft already owns the tag.
let releaseState;
try {
  const releases = await run(
    "gh",
    ["api", "--paginate", "--slurp", `repos/${repository}/releases?per_page=100`],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );
  releaseState = classifyReleaseState(JSON.parse(releases.stdout), tag);
} catch (error) {
  throw new Error(`Could not prove release absence: ${error.message}`, { cause: error });
}
assertReleasePreconditions({ tag, expectedSha, tagSha, releaseState, version });
assertUniqueAssetNames(values.assets ?? []);
const attestations = [];
for (const asset of values.assets ?? []) {
  const subjectDigest = `sha256:${digest(await readFile(asset))}`;
  try {
    const response = await run("gh", ["api", `repos/${repository}/attestations/${subjectDigest}`], {
      encoding: "utf8",
      windowsHide: true
    });
    attestations.push({
      asset,
      subjectDigest,
      state: classifyAttestationState(JSON.parse(response.stdout), subjectDigest)
    });
  } catch (error) {
    throw new Error(
      `Could not prove attestation absence for ${asset} (${subjectDigest}): ${error.message}`,
      { cause: error }
    );
  }
}
if (attestations.length > 0) assertNoExistingAttestations(attestations);
console.log(
  JSON.stringify(
    { tag, tagSha, releaseState, assetNames: values.assets ?? [], attestations },
    null,
    2
  )
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
