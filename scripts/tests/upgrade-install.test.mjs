import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  parseArguments,
  resolveCandidateArchive,
  scopedUpgradeIdentity
} from "../upgrade-install.mjs";

const version = "0.3.1";
const packageInput = `dist/fullstack-forge-skill-v${version}.tgz`;

test("upgrade smoke accepts the same explicit candidate for v0.1.0 and v0.2.2", () => {
  assert.deepEqual(parseArguments(["v0.1.0", "--package", packageInput]), {
    previousTag: "v0.1.0",
    packageInput
  });
  assert.deepEqual(parseArguments(["--package", packageInput, "v0.2.2"]), {
    previousTag: "v0.2.2",
    packageInput
  });
});

test("upgrade smoke keeps fixture packing as the explicit default compatibility mode", () => {
  assert.deepEqual(parseArguments([]), {
    previousTag: "fixture",
    packageInput: undefined
  });
  assert.deepEqual(parseArguments(["fixture"]), {
    previousTag: "fixture",
    packageInput: undefined
  });
});

test("scoped upgrade evidence names each genuine legacy source accurately", () => {
  assert.deepEqual(scopedUpgradeIdentity("v0.1.0"), {
    real_legacy_scoped_upgrade: true,
    scoped_previous_tag: "v0.1.0",
    real_v010_scoped_upgrade: true
  });
  assert.deepEqual(scopedUpgradeIdentity("v0.2.2"), {
    real_legacy_scoped_upgrade: true,
    scoped_previous_tag: "v0.2.2"
  });
});

test("upgrade smoke rejects malformed, missing, and repeated arguments", () => {
  assert.throws(() => parseArguments(["v1.2"]), /stable semantic version/u);
  assert.throws(() => parseArguments(["v0.2.2"]), /genuine legacy upgrade requires --package/u);
  assert.throws(() => parseArguments(["--package"]), /requires one path/u);
  assert.throws(() => parseArguments(["--package", ""]), /requires one path/u);
  assert.throws(
    () => parseArguments(["v0.1.0", "v0.2.2"]),
    /Unknown or repeated upgrade-install argument/u
  );
  assert.throws(
    () => parseArguments(["--package", packageInput, "--package", packageInput]),
    /Unknown or repeated upgrade-install argument/u
  );
});

test("upgrade smoke resolves only the exact in-root regular release package", async () => {
  await withTemporaryRoot(async (root) => {
    const dist = join(root, "dist");
    const expected = join(dist, `fullstack-forge-skill-v${version}.tgz`);
    await mkdir(dist);
    await writeFile(expected, "candidate bytes", "utf8");

    assert.equal(await resolveCandidateArchive(root, packageInput, version), expected);
    await assert.rejects(
      resolveCandidateArchive(root, "../fullstack-forge-skill-v0.3.1.tgz", version),
      /exact in-root release artifact/u
    );
    await assert.rejects(
      resolveCandidateArchive(root, "dist/another-package.tgz", version),
      /exact in-root release artifact/u
    );
  });
});

test("upgrade smoke rejects a directory at the exact candidate path", async () => {
  await withTemporaryRoot(async (root) => {
    const expected = join(root, "dist", `fullstack-forge-skill-v${version}.tgz`);
    await mkdir(expected, { recursive: true });

    await assert.rejects(
      resolveCandidateArchive(root, packageInput, version),
      /Expected regular candidate package/u
    );
  });
});

test("upgrade smoke rejects a symlinked candidate path", async (context) => {
  await withTemporaryRoot(async (root) => {
    const actualDist = join(root, "actual-dist");
    const linkedDist = join(root, "dist");
    await mkdir(actualDist);
    await writeFile(join(actualDist, `fullstack-forge-skill-v${version}.tgz`), "candidate", "utf8");
    try {
      await symlink(actualDist, linkedDist, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EACCES", "ENOTSUP", "EPERM"].includes(error?.code)) {
        context.skip(`symlinks unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    await assert.rejects(
      resolveCandidateArchive(root, packageInput, version),
      /Refusing symlinked filesystem path/u
    );
  });
});

async function withTemporaryRoot(callback) {
  const root = await mkdtemp(join(tmpdir(), "fullstack-forge-upgrade-test-"));
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
