import assert from "node:assert/strict";
import test from "node:test";
import { assertPublishableArchivePath, packageCommonPaths } from "../lib/package-policy.mjs";

const VERSION = "0.3.0";

test("package policy accepts only declared common files and managed platform roots", () => {
  for (const path of packageCommonPaths(VERSION))
    assert.doesNotThrow(() => assertPublishableArchivePath(path, VERSION), path);
  for (const path of [
    ".agents/skills/fullstack-forge/SKILL.md",
    ".claude/skills/forge-security/SKILL.md",
    ".github/skills/forge-feature/agents/openai.yaml"
  ])
    assert.doesNotThrow(() => assertPublishableArchivePath(path, VERSION), path);

  for (const path of [
    "package.json",
    "cli/src/index.ts",
    "docs/unlisted-local-note.md",
    "research/private-clone/README.md"
  ])
    assert.throws(() => assertPublishableArchivePath(path, VERSION), /allowlist/u, path);
});

test("package policy rejects private state, specifications, credentials, logs, and unsafe paths", () => {
  for (const path of [
    ".agents/skills/.audit/report.md",
    ".agents/skills/.audit-work/notes.md",
    ".agents/skills/.forge/report.json",
    ".agents/skills/fullstack-forge/FULLSTACK_FORGE_SPEC.md",
    ".agents/skills/fullstack-forge/fullstack-forge-development-vision/GOAL.md",
    ".agents/skills/fullstack-forge/fullstack-forge-dual-spec-audit.md",
    ".agents/skills/fullstack-forge/.env",
    ".agents/skills/fullstack-forge/release.log",
    ".agents/skills/fullstack-forge/credentials.json",
    ".agents/skills/fullstack-forge/../../escape.md",
    "C:/absolute.md",
    ".agents\\skills\\fullstack-forge\\SKILL.md"
  ])
    assert.throws(
      () => assertPublishableArchivePath(path, VERSION),
      /Unsafe|forward slashes|Forbidden/u,
      path
    );
});

test("package policy validates the semantic version used to build the allowlist", () => {
  assert.throws(() => packageCommonPaths("latest"), /Invalid package version/u);
});
