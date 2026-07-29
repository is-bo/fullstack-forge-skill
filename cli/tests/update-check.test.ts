import assert from "node:assert/strict";
import test from "node:test";
import {
  UPSTREAM_GIT_URL,
  checkUpdateAvailability,
  parseReleaseTags,
  publicReleaseArchive
} from "../src/update-check.js";

const hash = "a".repeat(40);

test("release-tag parsing accepts stable canonical refs and ignores hostile noise", () => {
  const output = [
    `${hash}\trefs/tags/v0.4.0`,
    `${hash}\trefs/tags/v1.0.0`,
    `${hash}\trefs/tags/v0.10.2`,
    `${hash}\trefs/tags/v1.0.0^{}`,
    `${hash}\trefs/tags/v01.2.3`,
    `${hash}\trefs/tags/v2.0.0-beta.1`,
    "\u001b[31mrefs/tags/v999.0.0\u001b[0m"
  ].join("\n");
  assert.deepEqual(parseReleaseTags(output), ["0.4.0", "0.10.2", "1.0.0"]);
});

test("published release installation uses an immutable credential-free archive", () => {
  const archive = new URL(publicReleaseArchive("1.3.0"));
  assert.equal(archive.protocol, "https:");
  assert.equal(archive.hostname, "codeload.github.com");
  assert.equal(archive.username, "");
  assert.equal(archive.password, "");
  assert.equal(archive.pathname, "/is-bo/fullstack-forge-skill/tar.gz/refs/tags/v1.3.0");
  assert.throws(() => publicReleaseArchive("v1.3.0"), /stable semantic version/u);
  assert.throws(() => publicReleaseArchive("main"), /stable semantic version/u);
});

test("update lookup uses a fixed argument vector and reports a newer release", async () => {
  const calls: Array<{
    executable: string;
    args: string[];
    cwd: string;
    timeout: number | undefined;
  }> = [];
  const result = await checkUpdateAvailability(
    "/project",
    false,
    "1.2.0",
    (executable, args, cwd, timeout) => {
      calls.push({ executable, args, cwd, timeout });
      return Promise.resolve({
        exitCode: 0,
        stdout: `${hash}\trefs/tags/v1.2.0\n${hash}\trefs/tags/v1.3.0\n`,
        stderr: ""
      });
    }
  );
  assert.deepEqual(calls, [
    {
      executable: "git",
      args: ["ls-remote", "--tags", "--refs", UPSTREAM_GIT_URL, "refs/tags/v*"],
      cwd: "/project",
      timeout: 10_000
    }
  ]);
  assert.deepEqual(result, {
    status: "WARNING",
    evidence: "v1.3.0 is available; v1.2.0 is running",
    latestVersion: "1.3.0"
  });
});

test("offline and failed update checks stay explicit warnings rather than passes", async () => {
  let invoked = false;
  const offline = await checkUpdateAvailability("/project", true, "0.4.0", () => {
    invoked = true;
    return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
  });
  assert.equal(invoked, false);
  assert.equal(offline.status, "WARNING");
  assert.equal(offline.unavailable, true);

  const failed = await checkUpdateAvailability("/project", false, "0.4.0", () =>
    Promise.resolve({
      exitCode: 1,
      stdout: "",
      stderr: "\u001b[31mapi_key=FixtureCredentialValue12345678901234567890\u001b[0m"
    })
  );
  assert.equal(failed.status, "WARNING");
  assert.equal(failed.unavailable, true);
  assert.doesNotMatch(failed.evidence, /FixtureCredentialValue/u);
  assert.equal(failed.evidence.includes("\u001b"), false);
});

test("current and development-ahead versions are distinguished", async () => {
  const runner = () =>
    Promise.resolve({
      exitCode: 0,
      stdout: `${hash}\trefs/tags/v0.4.0\n`,
      stderr: ""
    });
  assert.equal((await checkUpdateAvailability("/project", false, "0.4.0", runner)).status, "PASS");
  assert.match(
    (await checkUpdateAvailability("/project", false, "1.3.0", runner)).evidence,
    /newer than the latest public release/u
  );
});
