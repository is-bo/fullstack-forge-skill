import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the demo keeps its intentional onboarding link", async () => {
  const source = await readFile(new URL("./src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /target="_blank"/u);
});
