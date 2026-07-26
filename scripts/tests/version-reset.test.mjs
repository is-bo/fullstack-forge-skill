import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const VERSION = "0.1.0";

test("supported public version is consistently reset to 0.1.0", async () => {
  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
  const skill = JSON.parse(await readFile(join(projectRoot, "skill.json"), "utf8"));
  const constants = await readFile(join(projectRoot, "cli", "src", "constants.ts"), "utf8");
  const readme = await readFile(join(projectRoot, "README.md"), "utf8");

  assert.equal(packageJson.version, VERSION);
  assert.equal(packageLock.version, VERSION);
  assert.equal(packageLock.packages[""].version, VERSION);
  assert.equal(skill.version, VERSION);
  assert.match(constants, /VERSION = "0\.1\.0"/u);
  assert.match(
    readme,
    /npm install --save-dev "git\+https:\/\/github\.com\/is-bo\/fullstack-forge-skill\.git#v0\.1\.0"/u
  );
  assert.match(readme, /first intentionally supported public release/u);
});

test("active release documents contain only the supported version", async () => {
  const names = await readdir(join(projectRoot, "docs"));
  const versionedReleaseDocuments = names.filter((name) =>
    /^(?:AUDIT_CLASSIFICATION|FINAL_RELEASE_VERIFICATION|PRODUCT_GAP_REPORT|PRODUCT_LAYER_DESIGN|RELEASE_NOTES|RELEASE_VERIFICATION)_v/u.test(
      name
    )
  );
  assert.deepEqual(versionedReleaseDocuments.sort(), [
    "RELEASE_NOTES_v0.1.0.md",
    "RELEASE_VERIFICATION_v0.1.0.md"
  ]);
});
