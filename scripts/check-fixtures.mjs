import { join } from "node:path";
import { inspectFixtureManifests } from "./lib/fixture-manifests.mjs";
import { projectRoot } from "./project.mjs";

const result = await inspectFixtureManifests(join(projectRoot, "fixtures"));
if (result.errors.length > 0) {
  console.error(`Fixture dependency validation failed:\n${result.errors.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${result.manifests.length} non-installable fixture manifest(s); no dependency roots or fixture lockfiles found.`
  );
}
