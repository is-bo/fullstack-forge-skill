import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const VERSION = "0.3.1";

test("release candidate version is consistently 0.3.1 without a premature publication claim", async () => {
  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
  const skill = JSON.parse(await readFile(join(projectRoot, "skill.json"), "utf8"));
  const plugin = JSON.parse(
    await readFile(join(projectRoot, ".codex-plugin", "plugin.json"), "utf8")
  );
  const marketplace = JSON.parse(
    await readFile(join(projectRoot, ".agents", "plugins", "marketplace.json"), "utf8")
  );
  const constants = await readFile(join(projectRoot, "cli", "src", "constants.ts"), "utf8");
  const readme = await readFile(join(projectRoot, "README.md"), "utf8");
  const release = await readFile(join(projectRoot, "docs", "RELEASE.md"), "utf8");
  const verification = await readFile(
    join(projectRoot, "docs", "RELEASE_VERIFICATION_v0.3.1.md"),
    "utf8"
  );

  assert.equal(packageJson.version, VERSION);
  assert.equal(packageLock.version, VERSION);
  assert.equal(packageLock.packages[""].version, VERSION);
  assert.equal(skill.version, VERSION);
  assert.equal(plugin.version, VERSION);
  assert.equal(marketplace.plugins[0].source.version, VERSION);
  assert.match(constants, /VERSION = "0\.3\.1"/u);
  assert.match(
    readme,
    /npm install --save-dev "https:\/\/github\.com\/is-bo\/fullstack-forge-skill\/releases\/download\/v0\.3\.1\/fullstack-forge-skill-v0\.3\.1\.tgz"/u
  );
  assert.match(readme, /upstream-powered/iu);
  assert.match(readme, /v0\.3\.1.*candidate/isu);
  assert.match(readme, /v0\.2\.2.*current supported immutable\s+public release/isu);
  assert.match(readme, /npm package (?:is|remains) (?:not published|unpublished)/iu);
  assert.match(release, /`v0\.2\.2` is\s+the\s+current immutable public release/iu);
  assert.match(release, /`v0\.3\.1` is\s+the\s+current candidate/iu);
  assert.match(release, /approving-review requirement.*`0`/isu);
  assert.doesNotMatch(release, /administrators must require pull-request review/iu);
  assert.doesNotMatch(readme, /v0\.3\.1.*current supported public release/iu);
  assert.match(verification, /^Verification stage:\s*CANDIDATE_LOCAL\s*$/mu);
  assert.match(verification, /^Local validation status:\s*(?:PENDING|PASS)\s*$/mu);
  assert.match(verification, /^Remote publication status:\s*PENDING\s*$/mu);
  assert.doesNotMatch(
    verification,
    /^\s*[-*]\s*\[x\].*\b(?:CI|release|publish(?:ed|ing)?|provenance|immutable)\b/imu
  );
  assert.match(verification, /npm registry publication is `NOT_VERIFIED`/u);
  assert.match(verification, /v0\.3\.1 is unpublished/iu);
});

test("release documents preserve historical evidence and add the v0.3.1 candidate", async () => {
  const names = await readdir(join(projectRoot, "docs"));
  const versionedReleaseDocuments = names.filter((name) =>
    /^(?:AUDIT_CLASSIFICATION|FINAL_RELEASE_VERIFICATION|MIGRATION|PRODUCT_GAP_REPORT|PRODUCT_LAYER_DESIGN|RELEASE_NOTES|RELEASE_VERIFICATION)_v/u.test(
      name
    )
  );
  assert.deepEqual(versionedReleaseDocuments.sort(), [
    "MIGRATION_v0.2.0.md",
    "MIGRATION_v0.2.1.md",
    "MIGRATION_v0.2.2.md",
    "MIGRATION_v0.3.0.md",
    "MIGRATION_v0.3.1.md",
    "RELEASE_NOTES_v0.2.0.md",
    "RELEASE_NOTES_v0.2.1.md",
    "RELEASE_NOTES_v0.2.2.md",
    "RELEASE_NOTES_v0.3.0.md",
    "RELEASE_NOTES_v0.3.1.md",
    "RELEASE_VERIFICATION_v0.2.0.md",
    "RELEASE_VERIFICATION_v0.2.1.md",
    "RELEASE_VERIFICATION_v0.2.2.md",
    "RELEASE_VERIFICATION_v0.3.0.md",
    "RELEASE_VERIFICATION_v0.3.1.md"
  ]);
});
