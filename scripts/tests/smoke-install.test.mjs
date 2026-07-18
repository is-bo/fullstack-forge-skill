import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("packed artifact smoke install permits dependency resolution on a clean runner", async () => {
  const source = await readFile(join(scriptsRoot, "smoke-install.mjs"), "utf8");
  const installInvocation = source.match(/\[npmCli, "install",[\s\S]*?archive\]/u)?.[0];

  assert.ok(installInvocation, "smoke install must invoke npm install for the packed archive");
  assert.match(installInvocation, /"--ignore-scripts"/u);
  assert.doesNotMatch(installInvocation, /"--offline"/u);
});
