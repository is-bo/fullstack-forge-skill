import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseChecksums, renderFinalVerification } from "./lib/release-safety.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith("--") && values[index + 1] !== undefined)
      pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, [])
);
for (const name of ["tag", "sha", "run-url", "release-url", "asset-dir", "output"])
  if (typeof args[name] !== "string" || args[name].length === 0)
    throw new Error(`--${name} is required.`);
const checksums = parseChecksums(
  await readFile(resolve(args["asset-dir"], "SHA256SUMS.txt"), "utf8")
);
const assets = {
  archives: [...checksums.keys()].sort(),
  checksums: Object.fromEntries([...checksums.entries()])
};
const output = resolve(args.output);
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  renderFinalVerification({
    tag: args.tag,
    commit: args.sha,
    runUrl: args["run-url"],
    releaseUrl: args["release-url"],
    assets,
    generatedAt: new Date().toISOString()
  }),
  "utf8"
);
console.log(output);
