import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { projectRoot } from "../project.mjs";

test("Codex plugin manifest and npm marketplace entry stay synchronized", () => {
  const output = execFileSync(
    process.execPath,
    [join(projectRoot, "scripts", "check-codex-plugin.mjs")],
    {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true
    }
  );
  const result = JSON.parse(output);
  assert.equal(result.valid, true);
  assert.equal(result.plugin, "fullstack-forge");
  assert.equal(result.npm_package, "fullstack-forge-skill");
  assert.equal(result.adapter_root, "skills");
  assert.ok(result.adapter_count > 0);
});

test("Codex plugin retains package-local UI metadata and icon assets", async () => {
  for (const skill of ["fullstack-forge", "forge"]) {
    const metadata = await readFile(
      join(projectRoot, "skills", skill, "agents", "openai.yaml"),
      "utf8"
    );
    assert.match(metadata, /\.\/assets\/fullstack-forge-icon\.png/u);
    assert.equal(
      (
        await stat(join(projectRoot, "skills", skill, "assets", "fullstack-forge-icon.png"))
      ).isFile(),
      true
    );
  }
});

test("Codex plugin composition runs from its package cache against a clean target repository", async () => {
  const target = await mkdtemp(join(tmpdir(), "fullstack-forge-codex-plugin-"));
  try {
    await writeFile(
      join(target, "package.json"),
      `${JSON.stringify({ name: "clean-plugin-target", private: true }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(target, "app.ts"),
      "export function handler(input: string): string { return input.trim(); }\n",
      "utf8"
    );

    const adapterPath = join(projectRoot, "skills", "forge-security", "SKILL.md");
    const adapter = await readFile(adapterPath, "utf8");
    assert.match(adapter, /canonical playbook owns any deterministic composition step/u);
    assert.doesNotMatch(adapter, /composition-entry\.js/u);
    const canonicalPointer = /canonical=(\S+) -->/u.exec(adapter)?.[1];
    assert.ok(canonicalPointer, "plugin adapter must identify its canonical playbook");
    const canonicalPath = resolve(dirname(adapterPath), ...canonicalPointer.split("/"));
    const canonical = await readFile(canonicalPath, "utf8");
    const runnerPointer =
      /Resolve `([^`]*composition-entry\.js)` relative to this `SKILL\.md`/u.exec(canonical)?.[1];
    assert.ok(runnerPointer, "canonical playbook must identify its package-cache runner");
    assert.match(canonical, /absolute `runtime_root`/u);
    const runner = resolve(dirname(canonicalPath), ...runnerPointer.split("/"));
    const output = execFileSync(
      process.execPath,
      [runner, "security", "compose", "--root", target, "--dry-run", "--json"],
      { cwd: target, encoding: "utf8", windowsHide: true }
    );
    const result = JSON.parse(output);
    assert.equal(result.dry_run, true);
    assert.equal(result.composition_artifact, undefined);
    assert.equal(await realpath(result.runtime_root), await realpath(projectRoot));
    await assert.rejects(stat(join(target, ".fullstack-forge")), /ENOENT/u);

    const selected = result.compositions.flatMap((composition) => composition.selected);
    assert.ok(selected.length > 0);
    for (const source of selected) {
      const absolute = resolve(result.runtime_root, source.runtimePath);
      const contained = relative(result.runtime_root, absolute);
      assert.ok(contained !== ".." && !contained.startsWith(`..${sep}`), source.runtimePath);
      assert.equal((await stat(absolute)).isFile(), true, source.runtimePath);
    }
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
