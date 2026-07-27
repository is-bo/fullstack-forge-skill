// Maintainer-only: re-import one vendored provider at an explicit immutable target.
//
//   npm run upstream:update -- <provider> <tag-or-sha>
//   npm run upstream:update -- --all            (re-import every provider at its configured pin)
//
// This never commits, merges, tags, or releases. It leaves a reviewable Git diff and stops.
// Ordinary Forge development and the installed runtime never call it: `updatePolicy` is
// `reviewed-only` for every provider, and nothing in the runtime reaches the network.

import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CHECKSUM_FILENAME,
  CONTENT_DIRNAME,
  RECORD_FILENAME,
  contentChecksum,
  isSelected,
  listContentFiles,
  providerDirectory,
  readProviderConfig,
  scanDangerousInstructions,
  screenFile,
  sha256
} from "./lib/upstream.mjs";

const args = process.argv.slice(2);
const all = args.includes("--all");
const [providerId, target] = args.filter((value) => !value.startsWith("--"));
const config = await readProviderConfig();

if (!all && (providerId === undefined || target === undefined)) {
  console.error(
    "Usage: npm run upstream:update -- <provider> <tag-or-sha>\n" +
      "       npm run upstream:update -- --all\n\n" +
      `Providers: ${config.providers.map((entry) => entry.id).join(", ")}`
  );
  process.exit(2);
}

const selected = all
  ? config.providers
  : config.providers.filter((entry) => entry.id === providerId);
if (selected.length === 0) {
  console.error(`Unknown upstream provider: ${providerId}`);
  process.exit(2);
}

let failures = 0;
for (const provider of selected) {
  try {
    await importProvider(provider, all ? provider.upstreamCommit : target);
  } catch (error) {
    failures += 1;
    console.error(`\n${provider.id}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} provider import(s) failed. Nothing was committed.`);
  process.exit(1);
}
console.log(
  "\nImport complete. Review `git diff`, then run `npm run upstream:verify` and `npm run generate`.\n" +
    "Nothing has been committed, tagged, or published."
);

async function importProvider(provider, requestedTarget) {
  console.log(`\n=== ${provider.id} (${provider.repository}) ===`);
  const workspace = await mkdtemp(join(tmpdir(), `forge-upstream-${provider.id}-`));
  try {
    // No working tree is ever created: content is read from Git objects after screening. Blobs are
    // fetched eagerly rather than lazily so a partial-clone promisor fetch cannot fail mid-import
    // and leave a silently short selection.
    const url = `https://github.com/${provider.repository}.git`;
    run("git", ["clone", "--quiet", "--no-checkout", url, workspace]);

    // Verify repository identity before trusting anything inside it.
    const origin = run("git", ["-C", workspace, "remote", "get-url", "origin"]).trim();
    if (!origin.includes(provider.repository))
      throw new Error(`Cloned repository identity mismatch: ${origin}`);

    const commit = resolveTarget(workspace, requestedTarget);
    if (!/^[0-9a-f]{40}$/u.test(commit))
      throw new Error(`Target ${requestedTarget} did not resolve to an immutable commit`);
    if (commit !== provider.upstreamCommit) {
      throw new Error(
        `Resolved ${requestedTarget} to ${commit}, but config/upstream-providers.json pins ` +
          `${provider.upstreamCommit}. Update the pin deliberately, then re-run.`
      );
    }
    console.log(`  pinned ${provider.upstreamTag ?? "(no tag)"} -> ${commit}`);

    // Read the tree with file modes and take content straight from Git objects. Nothing is ever
    // materialised into a working tree, so a hostile entry cannot become a symlink, a junction, or
    // a nested checkout on disk before it has been screened.
    const tracked = [];
    for (const line of run("git", ["-C", workspace, "ls-tree", "-r", commit]).split("\n")) {
      const match = /^(\d{6}) (blob|commit|tree) ([0-9a-f]{40})\t(.*)$/u.exec(line.trimEnd());
      if (match === null) {
        if (line.trim() !== "") throw new Error(`Unparsable tree entry: ${line}`);
        continue;
      }
      const [, mode, type, blob, path] = match;
      if (!isSelected(path, provider)) continue;
      if (type === "commit" || mode === "160000")
        throw new Error(`Refusing nested Git repository (submodule) at ${path}`);
      if (mode === "120000") throw new Error(`Refusing symlink at ${path}`);
      if (mode !== "100644" && mode !== "100755")
        throw new Error(`Refusing unexpected file mode ${mode} at ${path}`);
      if (mode === "100755" && !provider.runtimeExecutables.includes(path))
        throw new Error(`Refusing undeclared executable-bit file at ${path}`);
      tracked.push({ path, blob });
    }

    const chosen = tracked.map((entry) => entry.path);
    const blobByPath = new Map(tracked.map((entry) => [entry.path, entry.blob]));
    if (chosen.length === 0) throw new Error("Selection matched no files");

    // Every selected path must exist upstream; a silently vanished path is a review event.
    const unmatched = provider.selectedPaths.filter(
      (pattern) => !chosen.some((path) => path === pattern || path.startsWith(pattern))
    );
    if (unmatched.length > 0)
      throw new Error(`Selected paths matched nothing upstream: ${unmatched.join(", ")}`);

    const files = new Map();
    const contents = new Map();
    const advisories = [];
    for (const path of chosen) {
      const buffer = readBlob(workspace, blobByPath.get(path));
      contents.set(path, buffer);
      const problems = screenFile({
        path,
        buffer,
        provider,
        documentFileExtensions: config.documentFileExtensions
      });
      if (problems.length > 0) throw new Error(`${path}: ${problems.join("; ")}`);
      files.set(path, sha256(buffer));
      if (/\.(?:md|mdc|txt)$/iu.test(path))
        advisories.push(...scanDangerousInstructions(path, buffer.toString("utf8")));
    }

    const licenseText = readLicenceEvidence(workspace, commit, provider);

    const destination = providerDirectory(provider.id);
    await rm(join(destination, CONTENT_DIRNAME), { recursive: true, force: true });
    for (const path of chosen) {
      const to = join(destination, CONTENT_DIRNAME, path);
      await mkdir(dirname(to), { recursive: true });
      await writeFile(to, contents.get(path));
    }

    const checksum = contentChecksum(files);
    const record = {
      id: provider.id,
      displayName: provider.displayName,
      repository: provider.repository,
      upstreamCommit: commit,
      upstreamTag: provider.upstreamTag ?? null,
      license: provider.license,
      licenseEvidence: provider.licenseEvidence,
      copyright: provider.copyright,
      importedAt: new Date().toISOString(),
      selectedPaths: [...provider.selectedPaths].sort(),
      excludedPaths: [...provider.excludedPaths].sort(),
      contentChecksum: checksum,
      fileCount: chosen.length,
      localPatches: [],
      runtimeExecutables: [...provider.runtimeExecutables].sort(),
      updatePolicy: "reviewed-only"
    };

    await mkdir(destination, { recursive: true });
    await writeFile(
      join(destination, RECORD_FILENAME),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(destination, CHECKSUM_FILENAME),
      `${JSON.stringify(Object.fromEntries([...files.entries()].sort()), null, 2)}\n`,
      "utf8"
    );
    await writeFile(join(destination, "LICENSE"), licenseText, "utf8");
    await writeFile(
      join(destination, "SOURCE.md"),
      renderSource(provider, record, advisories),
      "utf8"
    );
    await writeFile(join(destination, "NOTICE"), renderNotice(provider, record), "utf8");

    const imported = await listContentFiles(provider.id);
    console.log(`  imported ${imported.length} files, checksum ${checksum.slice(0, 16)}…`);
    if (advisories.length > 0) {
      console.log(`  ${advisories.length} instruction advisory hit(s) recorded in SOURCE.md:`);
      for (const advisory of advisories.slice(0, 8))
        console.log(
          `    ${advisory.hardDeny ? "DENY" : "note"} ${advisory.rule} — ${advisory.path}`
        );
    }
  } finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 5 });
  }
}

function resolveTarget(workspace, requested) {
  // `^{commit}` dereferences annotated tags, so a tag and its commit are never confused.
  for (const candidate of [`${requested}^{commit}`, requested]) {
    const result = spawnSync(
      "git",
      ["-C", workspace, "rev-parse", "--verify", "--quiet", candidate],
      {
        encoding: "utf8"
      }
    );
    if (result.status === 0) return result.stdout.trim();
  }
  const fetched = spawnSync("git", ["-C", workspace, "fetch", "--quiet", "origin", requested], {
    encoding: "utf8"
  });
  if (fetched.status === 0) {
    const result = spawnSync("git", ["-C", workspace, "rev-parse", "--verify", "FETCH_HEAD"], {
      encoding: "utf8"
    });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error(`Could not resolve ${requested} in the upstream repository`);
}

function readLicenceEvidence(workspace, commit, provider) {
  const [file] = provider.licenseEvidence.split("#");
  const result = spawnSync("git", ["-C", workspace, "show", `${commit}:${file}`], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0)
    throw new Error(`Licence evidence ${provider.licenseEvidence} is missing upstream`);
  const text = result.stdout.toString("utf8");
  if (provider.licenseEvidence.includes("#")) {
    // A README-declared grant: keep the declaration verbatim so the record is auditable.
    const match = /^#{1,6}\s*Licen[cs]e\s*$([\s\S]{0,400})/imu.exec(text);
    if (match === null) throw new Error(`No licence section found in ${file} for ${provider.id}`);
    if (!match[1].includes(provider.license))
      throw new Error(`${file} does not declare ${provider.license} for ${provider.id}`);
    return (
      `${provider.displayName} — licence evidence\n\n` +
      `The upstream repository ${provider.repository} has no LICENSE file at commit ` +
      `${provider.upstreamCommit}. The grant below is quoted verbatim from ${file}.\n\n` +
      `----- BEGIN ${file} LICENCE SECTION -----\n## License\n${match[1].trimEnd()}\n` +
      `----- END ${file} LICENCE SECTION -----\n`
    );
  }
  return text;
}

function renderSource(provider, record, advisories) {
  const lines = [
    `# ${provider.displayName}`,
    "",
    "Vendored into Fullstack Forge as a pinned, checksummed, review-only import. This directory is",
    "a pristine copy of the selected upstream files: Forge never edits it in place. Runtime",
    "adaptations are applied by the composition compiler from declared overlays and transforms.",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Repository | \`${record.repository}\` |`,
    `| Upstream commit | \`${record.upstreamCommit}\` |`,
    `| Upstream tag | ${record.upstreamTag === null ? "_none — pinned default-branch head_" : `\`${record.upstreamTag}\``} |`,
    `| Licence | ${record.license} |`,
    `| Licence evidence | \`${record.licenseEvidence}\` |`,
    `| Files imported | ${record.fileCount} |`,
    `| Content checksum | \`${record.contentChecksum}\` |`,
    `| Update policy | ${record.updatePolicy} |`,
    "",
    "## Selected paths",
    "",
    ...record.selectedPaths.map((path) => `- \`${path}\``),
    ""
  ];
  if (record.excludedPaths.length > 0) {
    lines.push("## Excluded paths", "", ...record.excludedPaths.map((p) => `- \`${p}\``), "");
  }
  if (record.runtimeExecutables.length > 0) {
    lines.push(
      "## Declared runtime executables",
      "",
      "These files are executable code. They are allowlisted here, and Forge runs them only through",
      "an explicit adapter with an explicit approval boundary — never because a module was loaded.",
      "",
      ...record.runtimeExecutables.map((p) => `- \`${p}\``),
      ""
    );
  }
  if (provider.notes) lines.push("## Import notes", "", provider.notes, "");
  lines.push(
    "## Instruction review",
    "",
    advisories.length === 0
      ? "The automated screen found no instruction matching Forge's dangerous-instruction rules."
      : "The automated screen recorded the hits below. Each was reviewed against Forge's approval" +
          " boundaries; guidance that merely *describes* an operation is advisory, and no vendored" +
          " instruction can bypass a Forge contract at runtime.",
    ""
  );
  for (const advisory of advisories) {
    lines.push(
      `- \`${advisory.rule}\`${advisory.hardDeny ? " **(hard-deny rule)**" : ""} — \`${advisory.path}\`: ${advisory.evidence}`
    );
  }
  lines.push(
    "",
    "## Attribution",
    "",
    `${record.copyright ?? provider.displayName}. Licensed under ${record.license}.`,
    "The upstream maintainers do not endorse Fullstack Forge.",
    ""
  );
  return lines.join("\n");
}

function renderNotice(provider, record) {
  return [
    `${provider.displayName}`,
    `${record.repository} @ ${record.upstreamCommit}`,
    `${record.copyright ?? provider.displayName}`,
    `Licensed under ${record.license}.`,
    "",
    "This product includes software developed by the above project. The original copyright",
    "notices and licence terms are preserved in this directory. Modifications, where any are",
    "applied, are made by Fullstack Forge's composition compiler at build time and are recorded",
    "in the provider's SOURCE.md and in THIRD_PARTY_NOTICES.md.",
    ""
  ].join("\n");
}

function readBlob(workspace, blob) {
  const result = spawnSync("git", ["-C", workspace, "cat-file", "blob", blob], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`Could not read upstream blob ${blob}`);
  return result.stdout;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0)
    throw new Error(
      `${command} ${commandArgs.slice(0, 3).join(" ")} failed: ${result.stderr?.trim() ?? ""}`
    );
  return result.stdout;
}
