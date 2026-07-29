import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, lstatSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { compileFile, runtimePathFor } from "../lib/upstream-compile.mjs";
import { contentChecksum, isForeignSkillInstallation, sha256 } from "../lib/upstream.mjs";

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

test("the shipped runtime registry binds every provider path to exact bytes", () => {
  for (const provider of registry.providers) {
    const prefix = `${provider.id}/`;
    const hashes = new Map(
      runtimeRelative
        .filter((path) => path.startsWith(prefix))
        .map((path) => [path.slice(prefix.length), sha256(readFileSync(join(upstreamRoot, path)))])
    );
    assert.equal(hashes.size, provider.fileCount, provider.id);
    assert.equal(contentChecksum(hashes), provider.runtimeChecksum, provider.id);
  }
});

test("the packaged-runtime upstream verifier has an explicit operational mode", () => {
  const result = spawnSync(process.execPath, ["scripts/upstream-verify.mjs", "--runtime"], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Shipped upstream runtime verification passed/u);
});

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

test("every shipped runtime Markdown file carries the complete Forge precedence boundary", () => {
  const markdown = runtimeRelative.filter((path) => /\.mdc?$/u.test(path));
  assert.ok(markdown.length > 0);
  for (const path of markdown) {
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    assert.ok(
      text.includes("fullstack-forge:precedence"),
      `${path} has no Forge precedence banner`
    );
    assert.match(
      text,
      /Do not install packages, enable telemetry, make network requests, deploy, publish, push, or modify remote systems unless the user explicitly approves/u,
      `${path} does not state the external-action approval boundary`
    );
    assert.ok(!text.startsWith("---"), `${path} retains independent authority frontmatter`);
  }
});

test("every shipped runtime Markdown file has structurally balanced code fences", () => {
  for (const path of runtimeRelative.filter((entry) => /\.mdc?$/u.test(entry))) {
    let open;
    let lineNumber = 0;
    for (const line of readFileSync(join(upstreamRoot, path), "utf8").split("\n")) {
      lineNumber += 1;
      const marker = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
      if (marker === undefined) continue;
      if (open === undefined)
        open = { character: marker[0], length: marker.length, line: lineNumber };
      else if (marker[0] === open.character && marker.length >= open.length) open = undefined;
    }
    assert.equal(
      open,
      undefined,
      `${path} has an unclosed fence from line ${open?.line ?? "unknown"}`
    );
  }
});

test("missing-asset transforms never inject omission prose into executable fences", () => {
  const injected = [];
  for (const path of runtimeRelative.filter((entry) => /\.mdc?$/u.test(entry))) {
    let open;
    let lineNumber = 0;
    for (const line of readFileSync(join(upstreamRoot, path), "utf8").split("\n")) {
      lineNumber += 1;
      const marker = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
      if (marker !== undefined) {
        if (open === undefined) open = { character: marker[0], length: marker.length };
        else if (marker[0] === open.character && marker.length >= open.length) open = undefined;
        continue;
      }
      if (
        open !== undefined &&
        /(?:unavailable upstream|upstream (?:asset|command|path) omitted)/iu.test(line)
      )
        injected.push(`${path}:${lineNumber}`);
    }
  }
  assert.deepEqual(injected, [], "a transform inserted omission prose inside a code fence");
});

test("the shipped runtime contains no unreferenced skill tree", () => {
  const rootsByProvider = new Map();
  for (const module of composition.modules) {
    for (const source of module.resolvedSources) {
      const relative = source.runtimePath.replace(
        `.fullstack-forge/upstream/${source.provider}/`,
        ""
      );
      const directory = relative.includes("/") ? relative.slice(0, relative.lastIndexOf("/")) : "";
      const roots = rootsByProvider.get(source.provider) ?? new Set();
      roots.add(directory);
      rootsByProvider.set(source.provider, roots);
    }
  }
  for (const path of runtimeRelative.filter((entry) => entry.endsWith("PLAYBOOK.md"))) {
    const [provider, ...rest] = path.split("/");
    const providerRelative = rest.join("/");
    const roots = rootsByProvider.get(provider) ?? new Set();
    assert.ok(
      [...roots].some(
        (root) =>
          root.length === 0 || providerRelative === root || providerRelative.startsWith(`${root}/`)
      ),
      `${path} is not reachable from any composition source`
    );
  }
});

test("dead Vercel optimizer and duplicated maintenance bundles do not ship", () => {
  for (const forbidden of [
    "vercel-agent-skills/skills/vercel-optimize/",
    "vercel-agent-skills/skills/react-best-practices/README.md",
    "vercel-agent-skills/skills/react-best-practices/AGENTS.md",
    "vercel-agent-skills/skills/react-best-practices/metadata.json"
  ])
    assert.ok(
      !runtimeRelative.some((path) => path.startsWith(forbidden)),
      `${forbidden} is dead package weight`
    );
});

test("authoritative upstream NOTICE files travel byte-for-byte with the compiled runtime", () => {
  const source = readFileSync(
    join(projectRoot, "third_party", "agent-skills", "impeccable", "content", "NOTICE.md")
  );
  const shipped = readFileSync(
    join(upstreamRoot, "impeccable", "UPSTREAM-NOTICES", "NOTICE.md.verbatim")
  );
  assert.deepEqual(shipped, source);
  assert.ok(
    !runtimeRelative.includes("impeccable/NOTICE.md"),
    "the legal NOTICE must not also be compiled as mutable runtime guidance"
  );
});

test("Sentry is pinned to its active source-of-truth repository and current licence", () => {
  const sentry = registry.providers.find((provider) => provider.id === "sentry-agent-skills");
  assert.ok(sentry);
  assert.equal(sentry.repository, "getsentry/sentry-for-ai");
  assert.equal(sentry.license, "MIT");
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

test("the 22 public Forge UI commands each resolve to operational vendored guidance", () => {
  assert.equal(uiCommands.commands.length, 22);
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

test("no foreign skill or global package installation instruction survives in runtime guidance", () => {
  const surviving = [];
  for (const path of runtimeRelative.filter((entry) => /\.mdc?$/u.test(entry))) {
    const text = readFileSync(join(upstreamRoot, path), "utf8");
    for (const [index, line] of text.split("\n").entries()) {
      if (isForeignSkillInstallation(line)) surviving.push(`${path}:${index + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(surviving, []);
});

test("critique snapshots are mapped into the Forge-managed tree", () => {
  assert.equal(
    overlays.impeccable.managedPaths[".impeccable/critiques"],
    ".fullstack-forge/ui/critique"
  );
});

test("the managed upstream tree ships no executable runtime", () => {
  const executables = runtimeRelative.filter((path) => path.endsWith(".mjs"));
  assert.deepEqual(executables, []);
  for (const provider of registry.providers) assert.deepEqual(provider.runtimeExecutables, []);
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

test("no vendored executable is shipped", () => {
  const executables = runtimeRelative.filter((path) => /\.(?:mjs|js|py|sh|bat|ps1)$/u.test(path));
  assert.deepEqual(executables, []);
});

test("Impeccable is compiled as guidance without a detector claim", () => {
  const audit = readFileSync(join(upstreamRoot, "impeccable", "reference", "audit.md"), "utf8");
  const critique = readFileSync(
    join(upstreamRoot, "impeccable", "reference", "critique.md"),
    "utf8"
  );
  const layout = readFileSync(join(upstreamRoot, "impeccable", "reference", "layout.md"), "utf8");
  const polish = readFileSync(join(upstreamRoot, "impeccable", "reference", "polish.md"), "utf8");
  const typeset = readFileSync(join(upstreamRoot, "impeccable", "reference", "typeset.md"), "utf8");
  assert.ok(audit.includes("Forge does not ship or invoke an Impeccable detector"));
  assert.ok(audit.includes("NOT_VERIFIED"));
  assert.ok(!audit.includes("Run the bundled detector"));
  assert.ok(critique.includes("Forge does not ship the upstream detector"));
  assert.ok(critique.includes("NOT_VERIFIED"));
  assert.ok(layout.includes("Forge-owned mechanical evidence"));
  assert.ok(polish.includes("Forge discovery and applicable module checks"));
  assert.ok(typeset.includes("Forge-owned mechanical evidence"));
  assert.ok(!safeStat(join(upstreamRoot, "impeccable", "reference", "live.md")));
  assert.ok(!uiCommands.commands.some((command) => command.name === "live"));
  assert.ok(!safeStat(join(upstreamRoot, "impeccable", "scripts")));
});

test("the registry manifest records an immutable pin and a licence for every provider", () => {
  assert.equal(registry.providers.length, 8);
  for (const provider of registry.providers) {
    assert.match(provider.upstreamCommit, /^[0-9a-f]{40}$/u);
    assert.ok(["MIT", "Apache-2.0"].includes(provider.license));
    assert.equal(provider.updatePolicy, "reviewed-only");
    assert.equal(provider.runtimeSkillFilename, "PLAYBOOK.md");
    assert.ok(safeStat(join(projectRoot, provider.runtimeRoot)), provider.runtimeRoot);
    for (const notice of provider.runtimeNotices) {
      assert.match(notice.sha256, /^[a-f0-9]{64}$/u);
      assert.ok(
        safeStat(join(projectRoot, provider.runtimeRoot, notice.runtimePath)),
        `${provider.id}/${notice.runtimePath}`
      );
      assert.ok(
        !/\.mdc?$/u.test(notice.runtimePath),
        "verbatim NOTICE must not be guidance Markdown"
      );
    }
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

test("foreign skill installers are neutralized across package managers and host roots", () => {
  const commands = [
    "npx skills add vendor/product",
    "npx -y skills add vendor/product -y",
    "npm install -g vendor-skill",
    "npm i -g vendor-skill",
    "yarn global add vendor-skill",
    "pnpm add -g vendor-skill",
    "bun add -g vendor-skill",
    "cp -R skill .claude/skills/vendor",
    "mv skill .agents/skills/vendor",
    "mkdir .cursor/skills/vendor",
    "git clone https://example.invalid/skill .gemini/skills/vendor",
    "tee .windsurf/skills/vendor/SKILL.md",
    "install skill .github/skills/vendor"
  ];
  const compiled = compileFile({
    providerId: "example",
    path: "reference/install.md",
    text: [
      "Install this skill first. Do not skip this installation.",
      "",
      "```bash",
      ...commands,
      "```"
    ].join("\n"),
    overlay: {},
    runtimePaths: new Set(["reference/install.md"]),
    reachable: true
  });
  for (const command of commands) assert.ok(!compiled.text.includes(command), command);
  for (const line of compiled.text.split("\n"))
    assert.ok(!isForeignSkillInstallation(line), `foreign installer survived: ${line}`);
  assert.equal((compiled.text.match(/```/gu) ?? []).length, 2, "code fences remain balanced");
  assert.match(compiled.text, /# fullstack-forge: foreign skill installation removed/u);
});

test("authority frontmatter is neutralized in command files, not only SKILL.md", () => {
  const compiled = compileFile({
    providerId: "example",
    path: "commands/build.md",
    text: [
      "---",
      "description: Build something",
      "argument-hint: [description]",
      "allowed-tools: [Read, Bash, Write, WebFetch]",
      "---",
      "",
      "# Build"
    ].join("\n"),
    overlay: {},
    runtimePaths: new Set(["commands/build.md"]),
    reachable: true
  });
  assert.ok(!compiled.text.startsWith("---"));
  assert.match(compiled.text, /deliberately inert/u);
  assert.match(compiled.text, /allowed-tools:/u);
  assert.match(compiled.text, /fullstack-forge:precedence/u);
});

test("missing links are neutralized without inserting prose into executable fences", () => {
  const compiled = compileFile({
    providerId: "example",
    path: "skills/x/SKILL.md",
    text: [
      "---",
      "name: x",
      "description: x",
      "---",
      "",
      "Run scripts/missing.py after reading [the helper](scripts/missing.sh).",
      "",
      "```bash",
      "python scripts/missing.py",
      "```"
    ].join("\n"),
    overlay: {},
    runtimePaths: new Set(["skills/x/PLAYBOOK.md"]),
    reachable: true
  });
  assert.match(compiled.text, /the helper _\(unavailable upstream reference omitted\)_/u);
  assert.match(compiled.text, /Run scripts\/missing\.py/u);
  assert.match(compiled.text, /python scripts\/missing\.py/u);
  assert.ok(!compiled.text.includes("scripts/missing.sh"));
  assert.equal((compiled.text.match(/```/gu) ?? []).length, 2, "code fences remain balanced");
});

test("relative-path neutralization leaves package names and prose slash groups intact", () => {
  const compiled = compileFile({
    providerId: "example",
    path: "skills/x/SKILL.md",
    text: [
      "`@sentry/nextjs` and `@sentry/sveltekit` remain package identifiers.  ",
      "Free/Pro/Business and DATE/TIME remain prose.",
      "Run scripts/missing.py."
    ].join("\n"),
    overlay: {},
    runtimePaths: new Set(["skills/x/PLAYBOOK.md"]),
    reachable: true
  });
  assert.match(compiled.text, /`@sentry\/nextjs` and `@sentry\/sveltekit`/u);
  assert.match(compiled.text, /Free\/Pro\/Business and DATE\/TIME/u);
  assert.ok(!compiled.text.includes("identifiers.  \n"), "trailing whitespace is normalized");
  assert.match(compiled.text, /scripts\/missing\.py/u);
});

test("ordinary project example paths remain executable while provider-owned gaps fail closed", () => {
  const compiled = compileFile({
    providerId: "example",
    path: "skills/x/SKILL.md",
    text: [
      "```bash",
      "node src/index.ts",
      "cat .github/workflows/ci.yml",
      "mkdir -p tasks && touch tasks/plan.md",
      "python scripts/missing.py",
      "```"
    ].join("\n"),
    overlay: {},
    runtimePaths: new Set(["skills/x/PLAYBOOK.md"]),
    reachable: true
  });
  assert.match(compiled.text, /node src\/index\.ts/u);
  assert.match(compiled.text, /cat \.github\/workflows\/ci\.yml/u);
  assert.match(compiled.text, /touch tasks\/plan\.md/u);
  assert.match(compiled.text, /python scripts\/missing\.py/u);
});

test("provider-root references to shipped content are rewritten to operational paths", () => {
  const compiled = compileFile({
    providerId: "example",
    path: "skills/x/SKILL.md",
    text: "Read [the checklist](references/check.md) and `references/check.md`.",
    overlay: {},
    runtimePaths: new Set(["skills/x/PLAYBOOK.md", "references/check.md"]),
    reachable: true
  });
  assert.match(compiled.text, /\[the checklist\]\(\.\.\/\.\.\/references\/check\.md\)/u);
  assert.match(compiled.text, /`\.fullstack-forge\/upstream\/example\/references\/check\.md`/u);
});

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
}

function withoutFencedCode(text) {
  let fence;
  return text
    .split("\n")
    .map((line) => {
      const marker = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1];
      if (marker !== undefined) {
        if (fence === undefined) fence = { character: marker[0], length: marker.length };
        else if (marker[0] === fence.character && marker.length >= fence.length) fence = undefined;
        return "";
      }
      return fence === undefined ? line : "";
    })
    .join("\n");
}

function localMarkdownTarget(raw) {
  let target = raw.trim();
  if (target.startsWith("<")) {
    const closing = target.indexOf(">");
    if (closing === -1) return undefined;
    target = target.slice(1, closing);
  } else {
    target = target.replace(/\s+["'(].*$/u, "");
  }
  if (
    target.length === 0 ||
    target === "..." ||
    target.startsWith("#") ||
    target.startsWith("/") ||
    target.startsWith("\\") ||
    target.includes("<") ||
    target.includes("{") ||
    /^[a-z][a-z\d+.-]*:/iu.test(target) ||
    target.startsWith("//")
  )
    return undefined;
  target = target.split(/[?#]/u, 1)[0];
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

test("no compiled guidance points at provider content Forge did not import", () => {
  // Regression guard: the managed-path rewrite used to turn instructions referencing unimported
  // upstream scripts into paths that looked installed and valid.
  const dangling = [];
  for (const provider of registry.providers) {
    const root = join(upstreamRoot, provider.id);
    const present = new Set(walk(root).map((file) => relative(root, file).split(sep).join("/")));
    const escaped = provider.id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const pattern = new RegExp(`\\.fullstack-forge/upstream/${escaped}/([\\w./-]+)`, "gu");
    for (const path of runtimeRelative.filter((entry) => entry.startsWith(`${provider.id}/`))) {
      if (!/\.mdc?$/u.test(path)) continue;
      const text = readFileSync(join(upstreamRoot, path), "utf8");
      for (const match of text.matchAll(pattern)) {
        const target = match[1].replace(/[.,;:)\]]+$/u, "").replace(/\/$/u, "");
        const available =
          present.has(target) ||
          [...present].some((candidate) => candidate.startsWith(`${target}/`));
        if (target.length > 0 && !available) dangling.push(`${path} -> ${target}`);
      }
    }
  }
  assert.deepEqual(dangling, [], "compiled guidance references unimported provider content");
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

test("every relative Markdown link in compiled runtime guidance resolves inside the runtime tree", () => {
  const dangling = [];
  for (const file of runtimeFiles.filter((entry) => /\.mdc?$/u.test(entry))) {
    const text = withoutFencedCode(readFileSync(file, "utf8"));
    const candidates = [
      ...[...text.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/gu)].map((match) => match[1]),
      ...[...text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gmu)].map((match) => match[1]),
      ...[...text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gu)].map((match) => match[1])
    ];
    for (const candidate of candidates) {
      const target = localMarkdownTarget(candidate);
      if (target === undefined) continue;
      const destination = resolve(dirname(file), target);
      const insideRuntime =
        destination === upstreamRoot || destination.startsWith(`${upstreamRoot}${sep}`);
      if (!insideRuntime || !safeStat(destination))
        dangling.push(
          `${relative(upstreamRoot, file).split(sep).join("/")} -> ${candidate.trim()}`
        );
    }
  }
  assert.deepEqual(dangling, [], "compiled runtime guidance contains dangling relative links");
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
    if (provider.copyright === null)
      assert.ok(
        licence.includes("No explicit upstream copyright notice was published"),
        `${provider.id} must state the absence of an upstream copyright notice`
      );
    else
      assert.ok(
        licence.includes(provider.copyright),
        `${provider.id} attributes the evidenced copyright holder`
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
