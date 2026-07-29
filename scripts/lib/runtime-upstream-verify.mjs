import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { projectRoot } from "../project.mjs";
import { contentChecksum, sha256 } from "./upstream.mjs";

const REGISTRY_PATH = join(projectRoot, ".fullstack-forge", "manifests", "upstream-registry.json");
const CONFIG_PATH = join(projectRoot, "config", "upstream-providers.json");

export async function verifyShippedUpstreamRuntime() {
  const problems = [];
  let checkedFiles = 0;
  let registry;
  let config;
  try {
    registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
    config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch (error) {
    return {
      problems: [`shipped upstream registry or provider config is unreadable: ${error.message}`],
      providers: 0,
      files: 0
    };
  }
  if (!Array.isArray(registry.providers) || !Array.isArray(config.providers))
    return {
      problems: ["shipped upstream registry or provider config is malformed"],
      providers: 0,
      files: 0
    };

  const configured = new Map(config.providers.map((provider) => [provider.id, provider]));
  const recorded = new Map(registry.providers.map((provider) => [provider.id, provider]));
  if (recorded.size !== registry.providers.length)
    problems.push("shipped upstream registry contains duplicate provider ids");

  for (const [id, provider] of configured) {
    const record = recorded.get(id);
    if (record === undefined) {
      problems.push(`${id}: missing from shipped upstream registry`);
      continue;
    }
    for (const field of [
      "repository",
      "upstreamCommit",
      "upstreamTag",
      "license",
      "licenseEvidence",
      "updatePolicy"
    ])
      if (JSON.stringify(record[field] ?? null) !== JSON.stringify(provider[field] ?? null))
        problems.push(`${id}: shipped ${field} differs from the reviewed provider config`);

    const expectedRoot = `.fullstack-forge/upstream/${id}`;
    if (record.runtimeRoot !== expectedRoot) {
      problems.push(`${id}: unexpected runtime root ${JSON.stringify(record.runtimeRoot)}`);
      continue;
    }
    const root = join(projectRoot, ...expectedRoot.split("/"));
    let files;
    try {
      files = await walkFiles(root);
    } catch (error) {
      problems.push(`${id}: shipped runtime cannot be inspected: ${error.message}`);
      continue;
    }
    const hashes = new Map();
    for (const full of files) {
      const path = relative(root, full).split(sep).join("/");
      const info = await lstat(full);
      if (info.isSymbolicLink()) {
        problems.push(`${id}: symbolic link in shipped runtime at ${path}`);
        continue;
      }
      if (path.split("/").at(-1) === "SKILL.md")
        problems.push(`${id}: host-discoverable upstream SKILL.md at ${path}`);
      const bytes = await readFile(full);
      hashes.set(path, sha256(bytes));
      checkedFiles += 1;
    }
    if (hashes.size !== record.fileCount)
      problems.push(`${id}: shipped file count ${hashes.size} != recorded ${record.fileCount}`);
    const checksum = contentChecksum(hashes);
    if (checksum !== record.runtimeChecksum)
      problems.push(
        `${id}: shipped runtime checksum ${checksum} != recorded ${record.runtimeChecksum}`
      );
    for (const required of ["UPSTREAM-LICENSE", "UPSTREAM-NOTICE", "UPSTREAM-SOURCE.md"])
      if (!hashes.has(required)) problems.push(`${id}: shipped runtime is missing ${required}`);
  }

  for (const id of recorded.keys())
    if (!configured.has(id)) problems.push(`${id}: registry provider is not in reviewed config`);
  return { problems, providers: configured.size, files: checkedFiles };
}

async function walkFiles(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) {
      out.push(full);
      continue;
    }
    if (entry.isDirectory()) out.push(...(await walkFiles(full)));
    else out.push(full);
  }
  return out.sort();
}
