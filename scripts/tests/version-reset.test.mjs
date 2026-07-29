import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const VERSION = "0.2.2";

test("release candidate version is consistently 0.2.2 without a premature publication claim", async () => {
  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
  const skill = JSON.parse(await readFile(join(projectRoot, "skill.json"), "utf8"));
  const constants = await readFile(join(projectRoot, "cli", "src", "constants.ts"), "utf8");
  const readme = await readFile(join(projectRoot, "README.md"), "utf8");

  assert.equal(packageJson.version, VERSION);
  assert.equal(packageLock.version, VERSION);
  assert.equal(packageLock.packages[""].version, VERSION);
  assert.equal(skill.version, VERSION);
  assert.match(constants, /VERSION = "0\.2\.2"/u);
  assert.match(
    readme,
    /npm install --save-dev "https:\/\/codeload\.github\.com\/is-bo\/fullstack-forge-skill\/tar\.gz\/refs\/tags\/v0\.2\.2"/u
  );
  assert.match(readme, /upstream-powered/iu);
  assert.match(readme, /release candidate/iu);
  assert.match(readme, /only when its immutable GitHub Release is published and verified/iu);
  assert.match(readme, /Do not install the\s+unpublished historical v0\.2\.0 tag/iu);
  assert.doesNotMatch(readme, /v0\.2\.2` is the current supported public release/iu);
});

test("release documents preserve the historical tag and add the correction candidate", async () => {
  const names = await readdir(join(projectRoot, "docs"));
  const versionedReleaseDocuments = names.filter((name) =>
    /^(?:AUDIT_CLASSIFICATION|FINAL_RELEASE_VERIFICATION|PRODUCT_GAP_REPORT|PRODUCT_LAYER_DESIGN|RELEASE_NOTES|RELEASE_VERIFICATION)_v/u.test(
      name
    )
  );
  assert.deepEqual(versionedReleaseDocuments.sort(), [
    "RELEASE_NOTES_v0.2.0.md",
    "RELEASE_NOTES_v0.2.1.md",
    "RELEASE_NOTES_v0.2.2.md",
    "RELEASE_VERIFICATION_v0.2.0.md",
    "RELEASE_VERIFICATION_v0.2.1.md",
    "RELEASE_VERIFICATION_v0.2.2.md"
  ]);
});
