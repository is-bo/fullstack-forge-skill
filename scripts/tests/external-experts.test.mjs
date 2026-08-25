import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();

async function json(path) {
  return JSON.parse(await readFile(join(projectRoot, path), "utf8"));
}

test("Taste remains an explicit, pinned, non-bundled advisory integration", async () => {
  const policy = await json("config/external-experts.json");
  const taste = policy.experts.find((expert) => expert.id === "taste");
  assert.ok(taste !== undefined);
  assert.equal(taste.revision, "e988add20dab0fa97d7a76781c48961c8184288e");
  assert.equal(taste.sha256, "aa194351b246b8b4799099d4ed7b033d29eab6e6e3d58d8d2172978be7b3ec89");
  assert.equal(taste.activation, "EXPLICIT_ONLY");
  assert.equal(taste.authority, "ADVISORY");
  assert.equal(taste.bundled, false);

  const composition = await json("config/module-composition.json");
  const composedSources = composition.modules.flatMap((module) => [
    ...module.primary,
    ...module.overlays,
    ...module.supplemental
  ]);
  assert.equal(
    composedSources.some(
      (source) => /taste/iu.test(source.provider) || /taste/iu.test(source.skill)
    ),
    false,
    "the experimental external expert must not consume automatic composition context"
  );
});

test("frontend experience skills expose the same safe external-expert contract", async () => {
  for (const slug of ["frontend", "ui", "ux"]) {
    const skill = await readFile(
      join(projectRoot, "src", "fullstack-forge", "commands", `forge-${slug}`, "SKILL.md"),
      "utf8"
    );
    assert.match(skill, /### Explicit external experts/u, slug);
    assert.match(skill, /not bundled and is never automatic/u, slug);
    assert.match(skill, /e988add20dab0fa97d7a76781c48961c8184288e/u, slug);
    assert.match(skill, /never download it during task execution/u, slug);
    assert.match(skill, /references\/shared\/external-experts\.md/u, slug);
  }
});

test("the user-facing external integration documents verification and precedence", async () => {
  const guide = await readFile(join(projectRoot, "docs", "EXTERNAL_EXPERTS.md"), "utf8");
  assert.match(guide, /Verify the file hash/u);
  assert.match(guide, /Disable implicit invocation/u);
  assert.match(
    guide,
    /accessibility, measured performance, and verification results take precedence/u
  );
  assert.match(guide, /do not fetch it automatically/u);

  const portable = await readFile(
    join(projectRoot, "src", "fullstack-forge", "references", "shared", "external-experts.md"),
    "utf8"
  );
  assert.match(portable, /External experts never participate in automatic composition/u);
  assert.match(portable, /Treat Taste as a read-only advisory comparator/u);
});
