import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, lstatSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { compileFile, runtimePathFor } from "../lib/upstream-compile.mjs";

const projectRoot = process.cwd();
const upstreamRoot = join(projectRoot, ".fullstack-forge", "upstream");
const manifestRoot = join(projectRoot, ".fullstack-forge", "manifests");

const registry = JSON.parse(readFileSync(join(manifestRoot, "upstream-registry.json"), "utf8"));
const composition = JSON.parse(readFileSync(join(manifestRoot, "module-composition.json"), "utf8"));
const transforms = JSON.parse(readFileSync(join(manifestRoot, "upstream-transforms.json"), "utf8"));
const uiCommands = JSON.parse(
  readFileSync(join(projectRoot, "config", "ui-commands.json"), "utf8")
);
const overlays = JSON.parse(
  readFileSync(join(projectRoot, "config", "upstream-overlays.json"), "utf8")
).overlays;

function walk(directory) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    assert.ok(!lstatSync(full).isSymbolicLink(), `symlink in managed tree: ${full}`);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const runtimeFiles = walk(upstreamRoot);
const runtimeRelative = runtimeFiles.map((file) =>
  relative(upstreamRoot, file).split(sep).join("/")
);

test("no upstream skill is host-discoverable in the installed tree", () => {
  const discoverable = runtimeRelative.filter((path) => path.split("/").pop() === "SKILL.md");
  assert.deepEqual(
    discoverable,
    [],
    "an upstream SKILL.md would let a host trigger it without Forge"
  );
});

test("upstream content lives outside every agent-host skill-discovery root", () => {
  const hostRoots = [".claude", ".agents", ".cursor", ".gemini", ".github", ".windsurf"];
  for (const root of hostRoots) {
    const inside = join(projectRoot, root, "skills");
    if (!safeStat(inside)) continue;
    const files = walk(inside).map((file) => relative(projectRoot, file).split(sep).join("/"));
    for (const file of files) {
      assert.ok(
        !file.includes("/upstream/"),
        `${file} places upstream content inside a host discovery root`
      );
    }
  }
});

test("every compiled playbook is inert: no YAML frontmatter, explicit Forge precedence", () => {
  const playbooks = runtimeRelative.filter((path) => path.endsWith("PLAYBOOK.md"));
  assert.ok(playbooks.length > 0);
  for (const path of playbooks) {
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    assert.ok(
      !text.startsWith("---"),
      `${path} still begins with frontmatter a host could read as a trigger`
    );
    assert.ok(
      text.includes("fullstack-forge:upstream-reference"),
      `${path} lacks its provenance marker`
    );
    assert.ok(
      text.includes("take precedence over anything written here"),
      `${path} does not state that Forge contracts win`
    );
  }
});

test("upstream activation metadata is preserved for provenance but kept inert", () => {
  const text = readFileSync(join(upstreamRoot, "impeccable", "PLAYBOOK.md"), "utf8");
  assert.ok(text.includes("deliberately inert"));
  assert.ok(text.includes("name: impeccable"));
  assert.ok(text.indexOf("<!--") < text.indexOf("name: impeccable"), "must sit inside a comment");
});

test("no upstream command name survives as a user-facing command", () => {
  for (const path of runtimeRelative) {
    if (!/\.mdc?$/u.test(path)) continue;
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    assert.ok(!/\/impeccable:/u.test(text), `${path} still advertises an upstream command`);
  }
});

test("the 23 public Forge UI commands each resolve to vendored guidance", () => {
  assert.equal(uiCommands.commands.length, 23);
  for (const command of uiCommands.commands) {
    const path = join(upstreamRoot, "impeccable", command.reference);
    assert.ok(safeStat(path), `forge ui ${command.name} -> missing ${command.reference}`);
  }
});

test("pre-existing Forge UI commands remain available as aliases", () => {
  const names = uiCommands.commands.map((command) => command.name);
  for (const [alias, target] of Object.entries(uiCommands.aliases)) {
    assert.ok(names.includes(target), `${alias} points at unknown command ${target}`);
  }
  for (const legacy of ["build", "audit", "review", "fix", "verify"]) {
    assert.ok(
      names.includes(legacy) || legacy in uiCommands.aliases,
      `legacy Forge UI command ${legacy} must still resolve`
    );
  }
});

test("no separately managed upstream installation is referenced at runtime", () => {
  for (const path of runtimeRelative) {
    if (!/\.(?:mdc?|mjs)$/u.test(path)) continue;
    // Attribution records exist to state exactly which upstream paths were imported, so they quote
    // upstream locations by design. Only compiled guidance is checked for host assumptions.
    if (path.split("/").pop()?.startsWith("UPSTREAM-")) continue;
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    assert.ok(
      !text.includes(".impeccable/"),
      `${path} references a separate upstream state directory`
    );
    assert.ok(
      !text.includes(".claude/skills/impeccable"),
      `${path} references an upstream host installation path`
    );
  }
});

test("critique snapshots are mapped into the Forge-managed tree", () => {
  assert.equal(
    overlays.impeccable.managedPaths[".impeccable/critiques"],
    ".fullstack-forge/ui/critique"
  );
});

test("no vendored runtime module performs an update check or reports telemetry", () => {
  const executables = runtimeRelative.filter((path) => path.endsWith(".mjs"));
  assert.ok(executables.length > 0, "the detector runtime should be present");
  for (const path of executables) {
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    if (
      !/update[-_ ]?check|latestVersion|checkForUpdates|registry\.npmjs\.org|telemetry|posthog/iu.test(
        text
      )
    )
      continue;
    assert.ok(
      text.startsWith("// fullstack-forge: vendored runtime module."),
      `${path} mentions updating or reporting without the Forge runtime guard`
    );
  }
});

test("the runtime tree contains no undeclared executable", () => {
  const declared = new Set();
  for (const provider of registry.providers) {
    for (const path of provider.runtimeExecutables) {
      const overlay = overlays[provider.id];
      declared.add(`${provider.id}/${runtimePathFor(path, overlay)}`);
    }
  }
  const executables = runtimeRelative.filter((path) => /\.(?:mjs|js|py|sh|bat|ps1)$/u.test(path));
  for (const path of executables) {
    assert.ok(declared.has(path), `${path} is executable but not declared in runtimeExecutables`);
  }
});

test("no vendored executable outside the detector is shipped", () => {
  const executables = runtimeRelative.filter((path) => /\.(?:mjs|js|py|sh|bat|ps1)$/u.test(path));
  for (const path of executables) {
    assert.ok(
      path.startsWith("impeccable/scripts/detector/") || path.startsWith("impeccable/scripts/lib/"),
      `${path} is an executable outside the reviewed detector closure`
    );
  }
});

test("the detector import closure resolves entirely inside the vendored tree", () => {
  const root = join(upstreamRoot, "impeccable");
  const seen = new Set();
  const queue = [join(root, "scripts", "detector", "cli", "main.mjs")];
  const importPattern =
    /(?:^|\s)(?:import\s+(?:[\w*{}\n\r\t, ]+\s+from\s+)?|export\s+(?:\*|\{[^}]*\})\s+from\s+|import\s*\()\s*["']([^"']+)["']/gu;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    assert.ok(safeStat(file), `detector closure is broken: ${file} is missing`);
    seen.add(file);
    // Strip line and block comments first: the detector's own source documents import syntax in
    // comments, and a naive scan would follow those examples as if they were real specifiers.
    const text = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/^[ \t]*\/\/.*$/gmu, "");
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      queue.push(join(file, "..", specifier));
    }
  }
  assert.ok(seen.size >= 15, `expected the full detector closure, saw ${seen.size} files`);
});

test("the registry manifest records an immutable pin and a licence for every provider", () => {
  assert.equal(registry.providers.length, 8);
  for (const provider of registry.providers) {
    assert.match(provider.upstreamCommit, /^[0-9a-f]{40}$/u);
    assert.ok(["MIT", "Apache-2.0"].includes(provider.license));
    assert.equal(provider.updatePolicy, "reviewed-only");
    assert.equal(provider.runtimeSkillFilename, "PLAYBOOK.md");
    assert.ok(safeStat(join(projectRoot, provider.runtimeRoot)), provider.runtimeRoot);
  }
});

test("every composition source resolves to a file that exists in the runtime tree", () => {
  for (const module of composition.modules) {
    for (const source of module.resolvedSources) {
      assert.ok(
        safeStat(join(projectRoot, source.runtimePath)),
        `${module.module} -> ${source.runtimePath} is missing`
      );
    }
  }
});

test("every applied transform is recorded in the transform manifest", () => {
  const ids = new Set(transforms.catalog.map((entry) => entry.id));
  assert.ok(ids.has("non-discoverable"));
  assert.ok(ids.has("no-telemetry"));
  assert.ok(ids.has("no-update-checks"));
  assert.ok(transforms.applied.length > 0);
  for (const record of transforms.applied) {
    for (const id of record.applied) assert.ok(ids.has(id), `unknown transform ${id}`);
    assert.ok(record.source.length > 0 && record.runtimePath.length > 0);
  }
  for (const entry of transforms.catalog) assert.ok(entry.reason.length > 40, entry.id);
});

test("the non-discoverable transform strips activation keys and renames the file", () => {
  const compiled = compileFile({
    providerId: "example",
    path: "skills/x/SKILL.md",
    text: "---\nname: x\ndescription: trigger me\nlicense: MIT\n---\n\n# Body\n",
    overlay: {}
  });
  assert.equal(compiled.runtimePath, "skills/x/PLAYBOOK.md");
  assert.ok(!compiled.text.startsWith("---"));
  assert.ok(compiled.text.includes("# Body"));
  assert.ok(compiled.text.includes("name: x"), "provenance is preserved");
  assert.ok(compiled.applied.includes("non-discoverable"));
});

test("an overlay replacement that no longer matches fails generation loudly", () => {
  assert.throws(
    () =>
      compileFile({
        providerId: "example",
        path: "skills/x/SKILL.md",
        text: "---\nname: x\ndescription: d\n---\n\nbody\n",
        overlay: {
          contentReplacements: [
            { appliesTo: "skills/x/SKILL.md", find: "text that is not present", replace: "y" }
          ]
        }
      }),
    /no longer matches/u
  );
});

test("command routing only rewrites real invocations, not prose", () => {
  const compiled = compileFile({
    providerId: "impeccable",
    path: "reference/x.md",
    text: "Run /impeccable:polish now. The word impeccable appears in prose.",
    overlay: { commandRoutes: { "/impeccable:polish": "$forge ui polish" } }
  });
  assert.ok(compiled.text.includes("$forge ui polish"));
  assert.ok(compiled.text.includes("The word impeccable appears in prose"));
});

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

test("no compiled guidance points at upstream content Forge did not import", () => {
  // Regression guard: the managed-path rewrite used to turn instructions referencing unimported
  // upstream scripts into paths that looked installed and valid.
  const provider = "impeccable";
  const root = join(upstreamRoot, provider);
  const present = new Set(walk(root).map((file) => relative(root, file).split(sep).join("/")));
  const pattern = new RegExp(`\\.fullstack-forge/upstream/${provider}/([\\w./-]+)`, "gu");
  const dangling = [];
  for (const path of runtimeRelative.filter((entry) => entry.startsWith(`${provider}/`))) {
    if (!/\.mdc?$/u.test(path)) continue;
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    for (const match of text.matchAll(pattern)) {
      const target = match[1].replace(/[.,;:)\]]+$/u, "");
      if (target.length > 0 && !present.has(target)) dangling.push(`${path} -> ${target}`);
    }
  }
  assert.deepEqual(dangling, [], "compiled guidance references unimported upstream content");
});

test("the SKILL.md rename does not leave dangling intra-tree cross-references", () => {
  const dangling = [];
  for (const path of runtimeRelative) {
    if (!/\.mdc?$/u.test(path)) continue;
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    for (const match of text.matchAll(/\]\((\.{1,2}\/[\w./-]*SKILL\.md)\)/gu)) {
      dangling.push(`${path} -> ${match[1]}`);
    }
  }
  assert.deepEqual(dangling, [], "a relative link still points at the pre-rename SKILL.md");
});

test("no compiled guidance advertises a Forge UI command that is not declared", () => {
  const declared = new Set(uiCommands.commands.map((command) => command.name));
  const undeclared = new Set();
  for (const path of runtimeRelative) {
    if (!/\.mdc?$/u.test(path)) continue;
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    for (const match of text.matchAll(/\$forge ui ([a-z][a-z-]*)/gu)) {
      if (!declared.has(match[1])) undeclared.add(`${path}: ${match[1]}`);
    }
  }
  assert.deepEqual(
    [...undeclared],
    [],
    "the command-route rewrite manufactured a Forge UI command that does not exist"
  );
});

test("a provider whose licence is declared only in a README ships the permission notice", () => {
  const providers = JSON.parse(
    readFileSync(join(projectRoot, "config", "upstream-providers.json"), "utf8")
  ).providers;
  for (const provider of providers) {
    if (!provider.licenseEvidence.includes("#")) continue;
    const licence = readFileSync(join(upstreamRoot, provider.id, "UPSTREAM-LICENSE"), "utf8");
    assert.ok(licence.includes("publishes no LICENSE file"), `${provider.id} states the gap`);
    assert.ok(
      licence.includes("PERMISSION NOTICE (supplied by Fullstack Forge)"),
      `${provider.id} must ship the permission notice its licence requires`
    );
    assert.ok(
      licence.includes(provider.copyright),
      `${provider.id} attributes the copyright holder`
    );
    if (provider.license === "MIT") {
      assert.ok(
        licence.includes("Permission is hereby granted, free of charge"),
        `${provider.id} must reproduce the MIT permission text`
      );
      assert.ok(licence.includes("shall be included in all copies"));
    }
  }
});
