import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { publicReleaseArchive } from "../lib/upgrade-source.mjs";
import { projectRoot } from "../project.mjs";

test("historical upgrade fixtures use public credential-free release archives", () => {
  const archive = publicReleaseArchive("v0.1.0");
  const url = new URL(archive);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "codeload.github.com");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.pathname, "/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v0.1.0");
  assert.ok(!archive.startsWith("git+"));
});

test("historical upgrade fixtures reject mutable or malformed release references", () => {
  for (const tag of ["main", "v0.1", "v01.0.0", "v1.02.3", "v0.1.0^{commit}", "../v0.1.0"])
    assert.throws(() => publicReleaseArchive(tag), /stable semantic version/u);
});

test("documented current-release installs use the same public archive transport", async () => {
  const documented = ["README.md", "docs/GETTING_STARTED.md", "docs/MIGRATION_v0.2.2.md"];
  for (const relativePath of documented) {
    const content = await readFile(join(projectRoot, relativePath), "utf8");
    assert.match(
      content,
      /https:\/\/codeload\.github\.com\/is-bo\/fullstack-forge-skill\/tar\.gz\/refs\/tags\/v0\.2\.2/u,
      relativePath
    );
    assert.doesNotMatch(
      content,
      /git\+https:\/\/github\.com\/is-bo\/fullstack-forge-skill\.git#v0\.2\.2/u,
      relativePath
    );
  }
});
