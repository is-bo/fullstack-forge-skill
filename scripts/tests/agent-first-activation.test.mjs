import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = join(fileURLToPath(new URL("../..", import.meta.url)));

test("agent-first evals cover automatic proportional and explicit workflows", async () => {
  const cases = JSON.parse(
    await readFile(join(projectRoot, "evals", "agent-first", "cases.json"), "utf8")
  );
  assert.equal(cases.length, 6);
  for (const entry of cases) {
    assert.ok(entry.prompt.length > 0);
    assert.ok(entry.modules.length > 0);
    assert.equal(entry.full_audit, false);
  }
  assert.ok(cases.some((entry) => entry.risk === "light" && !/forge/iu.test(entry.prompt)));
  assert.ok(cases.some((entry) => entry.risk === "standard" && !/forge/iu.test(entry.prompt)));
  assert.ok(cases.some((entry) => entry.risk === "high" && entry.block_unsupported_completion));
  assert.ok(cases.some((entry) => /^\$forge audit/u.test(entry.prompt)));
  assert.ok(cases.some((entry) => /^\$forge build/u.test(entry.prompt)));
});

test("canonical skills encode automatic use, proportional execution, and agent findings", async () => {
  const main = await readFile(join(projectRoot, "src", "fullstack-forge", "SKILL.md"), "utf8");
  const router = await readFile(
    join(projectRoot, "src", "fullstack-forge", "commands", "forge", "SKILL.md"),
    "utf8"
  );
  for (const content of [main, router]) {
    assert.match(content, /automatically/iu);
    assert.match(content, /does not need to invoke Forge|does not need to name Forge/iu);
  }
  assert.match(
    main,
    /UNDERSTAND[\s\S]*DISCOVER[\s\S]*SELECT[\s\S]*PLAN[\s\S]*IMPLEMENT[\s\S]*INSPECT[\s\S]*VERIFY[\s\S]*REPORT/u
  );
  assert.match(main, /Small, low-risk change/u);
  assert.match(main, /agent-reviewed-source/u);
});
