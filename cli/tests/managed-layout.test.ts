/**
 * Parity between the two managed-layout implementations.
 *
 * `cli/src/managed-layout.ts` renders adapters at installation time; `scripts/lib/managed-layout.mjs`
 * renders them at repository-generation time. If they ever disagree, `forge update` would rewrite
 * every bundled adapter with different bytes and the generated-copy check would fail — so both
 * modules already document that this test keeps them byte-identical. It does now.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { PACKAGE_ROOT } from "../src/constants.js";
import {
  ADAPTER_MARKER,
  ADAPTER_SCHEMA_VERSION,
  CANONICAL_ROOT_POSIX,
  adapterPointer,
  extractFrontmatter,
  isAdapter,
  isVerbatimHostFile,
  readAdapterMarker,
  renderAdapter
} from "../src/managed-layout.js";

type GeneratorModule = {
  ADAPTER_MARKER: string;
  ADAPTER_SCHEMA_VERSION: number;
  CANONICAL_ROOT_POSIX: string;
  adapterPointer: (hostSkillsRootPosix: string, skill: string) => string;
  extractFrontmatter: (text: string, label: string) => string;
  isAdapter: (text: string) => boolean;
  isVerbatimHostFile: (relativePath: string) => boolean;
  readAdapterMarker: (
    text: string
  ) => { version: number; skill: string; canonical: string } | undefined;
  renderAdapter: (input: { skill: string; pointer: string; frontmatter: string }) => string;
};

const generator = (await import(
  pathToFileURL(join(PACKAGE_ROOT, "scripts", "lib", "managed-layout.mjs")).href
)) as GeneratorModule;

const HOST_ROOTS = [
  ".agents/skills",
  ".claude/skills",
  ".cursor/skills",
  ".gemini/skills",
  ".github/skills",
  ".windsurf/skills",
  ".gemini/config/skills",
  ".codeium/windsurf/skills",
  ".copilot/skills"
];

test("installer and generator agree on every layout constant", () => {
  assert.equal(generator.ADAPTER_MARKER, ADAPTER_MARKER);
  assert.equal(generator.ADAPTER_SCHEMA_VERSION, ADAPTER_SCHEMA_VERSION);
  assert.equal(generator.CANONICAL_ROOT_POSIX, CANONICAL_ROOT_POSIX);
});

test("installer and generator render byte-identical adapters for every host root", () => {
  const frontmatter = 'name: forge-api\ndescription: "Audit API contracts."\n';
  for (const hostRoot of HOST_ROOTS) {
    const pointer = adapterPointer(hostRoot, "forge-api");
    assert.equal(generator.adapterPointer(hostRoot, "forge-api"), pointer);
    // A pointer must climb out of the host root and back down into the canonical root exactly once.
    assert.equal(
      pointer,
      `${"../".repeat(hostRoot.split("/").length + 1)}${CANONICAL_ROOT_POSIX}/forge-api/SKILL.md`
    );
    const rendered = renderAdapter({ skill: "forge-api", pointer, frontmatter });
    assert.equal(generator.renderAdapter({ skill: "forge-api", pointer, frontmatter }), rendered);
    assert.ok(isAdapter(rendered));
    assert.ok(generator.isAdapter(rendered));
    assert.deepEqual(readAdapterMarker(rendered), generator.readAdapterMarker(rendered));
    assert.match(rendered, /canonical playbook owns any deterministic composition step/u);
    assert.doesNotMatch(rendered, /composition-entry\.js/u);
  }
});

test("installer and generator reject the same unsafe inputs", () => {
  const frontmatter = "name: forge-api\ndescription: x\n";
  for (const skill of ["../escape", "a/b", "", ".hidden"]) {
    assert.throws(() => renderAdapter({ skill, pointer: "../../x", frontmatter }));
    assert.throws(() => generator.renderAdapter({ skill, pointer: "../../x", frontmatter }));
  }
  for (const pointer of ["x/y", "..//x", "/absolute"]) {
    assert.throws(() => renderAdapter({ skill: "forge-api", pointer, frontmatter }));
    assert.throws(() => generator.renderAdapter({ skill: "forge-api", pointer, frontmatter }));
  }
  for (const text of ["no frontmatter", "---\nname: x\n", "---\ndescription: x\n---\n"]) {
    assert.throws(() => extractFrontmatter(text, "fixture"));
    assert.throws(() => generator.extractFrontmatter(text, "fixture"));
  }
});

test("installer and generator classify the verbatim host exception identically", () => {
  for (const path of [
    "forge/agents/openai.yaml",
    "forge/assets/fullstack-forge-icon.png",
    "forge/SKILL.md",
    "fullstack-forge/references/shared/module-contract.md",
    "agents/openai.yaml"
  ])
    assert.equal(isVerbatimHostFile(path), generator.isVerbatimHostFile(path), path);
});

test("frontmatter extraction tolerates BOM and CRLF the same way in both modules", () => {
  const text = "﻿---\r\nname: forge-api\r\ndescription: x\r\n---\r\nbody\r\n";
  assert.equal(extractFrontmatter(text, "fixture"), generator.extractFrontmatter(text, "fixture"));
  assert.equal(extractFrontmatter(text, "fixture"), "name: forge-api\ndescription: x\n");
});
