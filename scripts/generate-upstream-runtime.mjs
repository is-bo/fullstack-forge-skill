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
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { assertNoSymlinkPath } from "./lib/fs-safety.mjs";
import { writeGeneratedOwnership } from "./lib/generated-ownership.mjs";
import { projectRoot } from "./project.mjs";
import {
  CONTENT_DIRNAME,
  contentChecksum,
  listContentFiles,
  providerDirectory,
  readProviderConfig,
  readProviderRecord,
  scanDangerousInstructions,
  sha256
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
const reachableRoots = new Map();
for (const module of composition.modules) {
  for (const entry of [...module.primary, ...module.overlays, ...(module.supplemental ?? [])]) {
    const overlay = overlays[entry.provider];
    if (overlay === undefined) continue;
    const runtimePath = runtimePathFor(entry.path, overlay);
    const directory = posix.dirname(runtimePath);
    const roots = reachableRoots.get(entry.provider) ?? new Set();
    roots.add(directory === "." ? "" : directory);
    reachableRoots.set(entry.provider, roots);
  }
}

await assertNoSymlinkPath(projectRoot, UPSTREAM_ROOT);
await rm(UPSTREAM_ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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
  const roots = reachableRoots.get(provider.id) ?? new Set();
  const runtimeFilesForProvider = files.filter((path) => {
    // Licence and NOTICE evidence is distributed separately below as attribution data. Compiling
    // the same legal file as runtime guidance both duplicates package weight and lets path or
    // command transforms alter legal prose. A README that merely contains a licence section may
    // still be useful guidance, so only conventional standalone legal filenames are excluded.
    const legalEvidence = new Set([
      provider.licenseEvidence.split("#", 1)[0],
      ...(provider.noticeEvidence ?? [])
    ]);
    if (legalEvidence.has(path) && /(?:^|\/)(?:licen[cs]e|notice)(?:\.[^/]*)?$/iu.test(path))
      return false;
    const runtimePath = runtimePathFor(path, overlay);
    return [...roots].some(
      (root) => root.length === 0 || runtimePath === root || runtimePath.startsWith(`${root}/`)
    );
  });
  // The full runtime file set is resolved before any file is compiled, so a transform can tell the
  // difference between a reference Forge imported and one it deliberately left out.
  const runtimePaths = new Set(
    runtimeFilesForProvider.map((path) => runtimePathFor(path, overlay))
  );
  const runtimeFiles = [];
  const runtimeHashes = new Map();
  const runtimeNotices = [];
  for (const path of runtimeFilesForProvider) {
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
        runtimePaths,
        reachable: [...roots].some(
          (root) => root.length === 0 || runtimePath === root || runtimePath.startsWith(`${root}/`)
        )
      });
      runtimePath = compiled.runtimePath;
      output = Buffer.from(compiled.text, "utf8");
      applied = compiled.applied;
      if (/\.mdc?$/iu.test(runtimePath)) {
        const foreignInstallers = scanDangerousInstructions(runtimePath, compiled.text).filter(
          (finding) => finding.rule === "foreign-skill-install"
        );
        if (foreignInstallers.length > 0)
          throw new Error(
            `${provider.id}/${runtimePath}: foreign skill installation instruction survived compilation: ${foreignInstallers[0].evidence}`
          );
      }
    }

    const destination = join(UPSTREAM_ROOT, provider.id, runtimePath);
    await assertNoSymlinkPath(UPSTREAM_ROOT, destination);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFileWithRetry(destination, output);
    compiledFiles += 1;
    runtimeFiles.push(runtimePath);
    runtimeHashes.set(runtimePath, sha256(output));
    if (applied.length > 0)
      transformRecords.push({ provider: provider.id, source: path, runtimePath, applied });
  }

  // Attribution travels with the content: the distributed package carries each provider's licence,
  // notice, and provenance record next to the guidance it covers, not only in the repository.
  for (const attribution of ["LICENSE", "NOTICE", "SOURCE.md"]) {
    let text = await readFile(join(providerDirectory(provider.id), attribution), "utf8");
    let applied = [];
    if (attribution === "SOURCE.md") {
      const compiled = compileFile({
        providerId: provider.id,
        path: attribution,
        text,
        overlay,
        runtimePaths: new Set([...runtimePaths, "SOURCE.md"]),
        reachable: true
      });
      text = compiled.text;
      applied = compiled.applied;
    }
    const destination = join(UPSTREAM_ROOT, provider.id, `UPSTREAM-${attribution}`);
    await writeFileWithRetry(destination, text, "utf8");
    runtimeFiles.push(`UPSTREAM-${attribution}`);
    runtimeHashes.set(`UPSTREAM-${attribution}`, sha256(Buffer.from(text, "utf8")));
    compiledFiles += 1;
    if (applied.length > 0)
      transformRecords.push({
        provider: provider.id,
        source: attribution,
        runtimePath: `UPSTREAM-${attribution}`,
        applied
      });
  }
  for (const noticePath of record.noticeEvidence ?? []) {
    const bytes = await readFile(join(providerDirectory(provider.id), CONTENT_DIRNAME, noticePath));
    // Verbatim legal notices are data, not runtime guidance. Keep their bytes exact and give them
    // a non-Markdown suffix so every shipped runtime Markdown file can carry the Forge precedence
    // boundary without altering an upstream NOTICE.
    const runtimePath = posix.join("UPSTREAM-NOTICES", `${noticePath}.verbatim`);
    const destination = join(UPSTREAM_ROOT, provider.id, runtimePath);
    await mkdir(join(destination, ".."), { recursive: true });
    await writeFileWithRetry(destination, bytes);
    runtimeFiles.push(runtimePath);
    runtimeHashes.set(runtimePath, sha256(bytes));
    runtimeNotices.push({
      sourcePath: noticePath,
      runtimePath,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
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
    copyrightEvidence: record.copyrightEvidence,
    noticeEvidence: record.noticeEvidence,
    contentChecksum: record.contentChecksum,
    updatePolicy: record.updatePolicy,
    runtimeRoot: posix.join(".fullstack-forge", "upstream", record.id),
    runtimeSkillFilename: RUNTIME_SKILL_FILENAME,
    fileCount: runtimeFiles.length,
    runtimeChecksum: contentChecksum(runtimeHashes),
    runtimeExecutables: record.runtimeExecutables,
    runtimeNotices
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
  ...(composition.workflowContracts === undefined
    ? {}
    : { workflowContracts: composition.workflowContracts }),
  modes: composition.modes,
  precedence: "fullstack-forge/references/shared/composition-precedence.md",
  modules: composition.modules.map((module) => ({
    ...module,
    contextBudget: module.contextBudget ?? composition.defaultContextBudget,
    ...(module.forgeContracts === undefined ? {} : { forgeContracts: module.forgeContracts }),
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
await writeGeneratedOwnership(UPSTREAM_ROOT, "upstream");
await writeGeneratedOwnership(MANIFEST_ROOT, "manifests", [
  "module-composition.json",
  "upstream-registry.json",
  "upstream-transforms.json"
]);

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
  if (current !== next) await writeFileWithRetry(path, next, "utf8");
}

async function writeFileWithRetry(path, data, encoding) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await writeFile(path, data, encoding);
      return;
    } catch (error) {
      const transientWindowsLock =
        process.platform === "win32" &&
        ["EBUSY", "EPERM", "UNKNOWN"].includes(error?.code) &&
        attempt < 10;
      if (!transientWindowsLock) throw error;
      await delay(100 * (attempt + 1));
    }
  }
}
