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
  assert.match(source, /"pack", "--ignore-scripts", "--json"/u);
  assert.match(source, /--package must identify the exact release artifact/u);
  assert.match(source, /"validate", "--json"/u);
  assert.match(source, /"security", "compose"/u);
  assert.match(source, /"doctor", "--offline"/u);
  assert.match(source, /availability !== "source-checkout-only"/u);
  assert.doesNotMatch(source, /scripts", "upstream-verify\.mjs/u);
});

test("link checks stay within Forge-managed skill roots", async () => {
  const source = await readFile(join(scriptsRoot, "smoke-install.mjs"), "utf8");

  assert.match(source, /assertNoLinks\(dirname\(installedSkill\)\)/u);
  assert.doesNotMatch(source, /assertNoLinks\(consumerRoot\)/u);
});
