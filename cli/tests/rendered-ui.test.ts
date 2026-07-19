import assert from "node:assert/strict";
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { inspectRenderedUi } from "../src/rendered-ui.js";
import type { CliOptions } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

function options(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    cwd: process.cwd(),
    json: true,
    dryRun: false,
    global: false,
    offline: false,
    allowRun: false,
    safe: false,
    ...overrides
  };
}

async function emptyProject(root: string): Promise<void> {
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({ name: "rendered-ui-test", private: true })}\n`,
    "utf8"
  );
}

test("rendered-ui inspection blocks without a URL instead of guessing one", async () => {
  await withTemporaryProject("rendered-ui-no-url", async (root) => {
    await emptyProject(root);
    const response = await inspectRenderedUi(root, [], options());
    assert.equal(response.exitCode, 2);
    assert.equal(response.value.status, "BLOCKED");
    assert.match(response.value.reason ?? "", /URL is required/u);
    assert.equal(response.value.findings.length, 0);
  });
});

test("rendered-ui inspection rejects invalid and non-http URLs", async () => {
  await withTemporaryProject("rendered-ui-bad-url", async (root) => {
    await emptyProject(root);
    const invalid = await inspectRenderedUi(root, ["not-a-url"], options());
    assert.equal(invalid.value.status, "BLOCKED");
    const fileUrl = await inspectRenderedUi(root, ["file:///etc/passwd"], options());
    assert.equal(fileUrl.value.status, "BLOCKED");
    assert.match(fileUrl.value.reason ?? "", /http and https/u);
  });
});

test("rendered-ui inspection requires --allow-run for non-loopback destinations", async () => {
  await withTemporaryProject("rendered-ui-remote", async (root) => {
    await emptyProject(root);
    const response = await inspectRenderedUi(root, ["https://example.com/"], options());
    assert.equal(response.exitCode, 2);
    assert.equal(response.value.status, "BLOCKED");
    assert.match(response.value.reason ?? "", /--allow-run/u);
  });
});

test("rendered-ui inspection blocks when Playwright is absent from the audited project", async () => {
  await withTemporaryProject("rendered-ui-no-driver", async (root) => {
    await emptyProject(root);
    const response = await inspectRenderedUi(root, ["http://127.0.0.1:3000/"], options());
    assert.equal(response.exitCode, 2);
    assert.equal(response.value.status, "BLOCKED");
    assert.match(response.value.reason ?? "", /Playwright is not installed/u);
    assert.match(response.value.reason ?? "", /NOT_VERIFIED/u);
    await assert.rejects(access(join(root, ".forge")), "BLOCKED runs must not write evidence");
  });
});
