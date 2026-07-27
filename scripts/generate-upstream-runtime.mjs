// Generates Forge's managed upstream runtime tree and manifests from pristine vendored content.
//
//   .fullstack-forge/upstream/<provider>/…      compiled, non-discoverable references
//   .fullstack-forge/manifests/upstream-registry.json
//   .fullstack-forge/manifests/module-composition.json
//   .fullstack-forge/manifests/upstream-transforms.json
//
// Deterministic: same inputs produce byte-identical output, so `git diff --exit-code` after
// `npm run generate` is a real check. Runs offline.

import { Buffer } from "node:buffer";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { assertNoSymlinkPath } from "./lib/fs-safety.mjs";
import { projectRoot } from "./project.mjs";
import {
  CONTENT_DIRNAME,
  listContentFiles,
  providerDirectory,
  readProviderConfig,
  readProviderRecord
} from "./lib/upstream.mjs";
import {
  compileFile,
  runtimePathFor,
  transformCatalog,
  RUNTIME_SKILL_FILENAME
} from "./lib/upstream-compile.mjs";

const MANAGED_ROOT = join(projectRoot, ".fullstack-forge");
const UPSTREAM_ROOT = join(MANAGED_ROOT, "upstream");
const MANIFEST_ROOT = join(MANAGED_ROOT, "manifests");

const config = await readProviderConfig();
const overlays = JSON.parse(
  await readFile(join(projectRoot, "config", "upstream-overlays.json"), "utf8")
).overlays;
const composition = JSON.parse(
  await readFile(join(projectRoot, "config", "module-composition.json"), "utf8")
);

await assertNoSymlinkPath(projectRoot, UPSTREAM_ROOT);
await rm(UPSTREAM_ROOT, { recursive: true, force: true });
await mkdir(UPSTREAM_ROOT, { recursive: true });
await mkdir(MANIFEST_ROOT, { recursive: true });

const registry = [];
const transformRecords = [];
let compiledFiles = 0;

for (const provider of config.providers) {
  const record = await readProviderRecord(provider.id);
  const overlay = overlays[provider.id];
  if (overlay === undefined)
    throw new Error(`config/upstream-overlays.json has no overlay for ${provider.id}`);

  const files = await listContentFiles(provider.id);
  // The full runtime file set is resolved before any file is compiled, so a transform can tell the
  // difference between a reference Forge imported and one it deliberately left out.
  const runtimePaths = new Set(files.map((path) => runtimePathFor(path, overlay)));
  const runtimeFiles = [];
  for (const path of files) {
    const source = join(providerDirectory(provider.id), CONTENT_DIRNAME, path);
    const bytes = await readFile(source);
    let runtimePath = runtimePathFor(path, overlay);
    let output = bytes;
    let applied = [];

    if (/\.(?:mdc?|txt|mjs)$/iu.test(path) || path.endsWith("SKILL.md")) {
      const compiled = compileFile({
        providerId: provider.id,
        path,
        text: bytes.toString("utf8"),
        overlay,
        runtimePaths
      });
      runtimePath = compiled.runtimePath;
      output = Buffer.from(compiled.text, "utf8");
      applied = compiled.applied;
    }

    const destination = join(UPSTREAM_ROOT, provider.id, runtimePath);
    await assertNoSymlinkPath(UPSTREAM_ROOT, destination);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFile(destination, output);
    compiledFiles += 1;
    runtimeFiles.push(runtimePath);
    if (applied.length > 0)
      transformRecords.push({ provider: provider.id, source: path, runtimePath, applied });
  }

  // Attribution travels with the content: the distributed package carries each provider's licence,
  // notice, and provenance record next to the guidance it covers, not only in the repository.
  for (const attribution of ["LICENSE", "NOTICE", "SOURCE.md"]) {
    const text = await readFile(join(providerDirectory(provider.id), attribution), "utf8");
    const destination = join(UPSTREAM_ROOT, provider.id, `UPSTREAM-${attribution}`);
    await writeFile(destination, text, "utf8");
    runtimeFiles.push(`UPSTREAM-${attribution}`);
    compiledFiles += 1;
  }

  // A discoverable upstream skill file inside the installed tree would let a host trigger upstream
  // guidance without Forge. Fail generation rather than ship one.
  const discoverable = runtimeFiles.filter((path) => path.split("/").pop() === "SKILL.md");
  if (discoverable.length > 0)
    throw new Error(
      `${provider.id}: ${discoverable.length} upstream SKILL.md file(s) would remain host-discoverable`
    );

  registry.push({
    id: record.id,
    displayName: record.displayName,
    repository: record.repository,
    upstreamCommit: record.upstreamCommit,
    upstreamTag: record.upstreamTag,
    license: record.license,
    licenseEvidence: record.licenseEvidence,
    copyright: record.copyright,
    contentChecksum: record.contentChecksum,
    updatePolicy: record.updatePolicy,
    runtimeRoot: posix.join(".fullstack-forge", "upstream", record.id),
    runtimeSkillFilename: RUNTIME_SKILL_FILENAME,
    fileCount: runtimeFiles.length,
    runtimeExecutables: record.runtimeExecutables
  });
}

await writeJson(join(MANIFEST_ROOT, "upstream-registry.json"), {
  schemaVersion: 1,
  generatedBy: "scripts/generate-upstream-runtime.mjs",
  discoverability:
    "Upstream content is installed outside every agent-host skill-discovery root and every " +
    "upstream SKILL.md is compiled to PLAYBOOK.md with its activation frontmatter removed. No " +
    "upstream skill can be discovered, announced, or triggered independently of Fullstack Forge.",
  offline:
    "No runtime component performs an upstream update check, a telemetry report, or any network request.",
  providers: registry
});

await writeJson(join(MANIFEST_ROOT, "module-composition.json"), {
  schemaVersion: composition.schemaVersion,
  generatedBy: "scripts/generate-upstream-runtime.mjs",
  defaultContextBudget: composition.defaultContextBudget,
  modes: composition.modes,
  precedence: "fullstack-forge/references/shared/composition-precedence.md",
  modules: composition.modules.map((module) => ({
    ...module,
    contextBudget: module.contextBudget ?? composition.defaultContextBudget,
    resolvedSources: [...module.primary, ...module.overlays, ...(module.supplemental ?? [])].map(
      (entry) => ({
        provider: entry.provider,
        skill: entry.skill,
        runtimePath: posix.join(
          ".fullstack-forge",
          "upstream",
          entry.provider,
          runtimePathFor(entry.path, overlays[entry.provider])
        )
      })
    )
  }))
});

await writeJson(join(MANIFEST_ROOT, "upstream-transforms.json"), {
  schemaVersion: 1,
  generatedBy: "scripts/generate-upstream-runtime.mjs",
  catalog: transformCatalog(),
  applied: transformRecords.sort(
    (a, b) => a.provider.localeCompare(b.provider) || a.source.localeCompare(b.source)
  )
});

console.log(
  `Compiled ${compiledFiles} upstream files across ${registry.length} providers; ` +
    `${transformRecords.length} files transformed.`
);

async function writeJson(path, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  let current = "";
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current !== next) await writeFile(path, next, "utf8");
}
