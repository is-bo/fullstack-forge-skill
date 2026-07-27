// Reports what is vendored and where each provider is used at runtime. Offline and read-only.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { listContentFiles, readProviderConfig, readProviderRecord } from "./lib/upstream.mjs";
import { projectRoot } from "./project.mjs";

const config = await readProviderConfig();
const composition = JSON.parse(
  await readFile(join(projectRoot, "config", "module-composition.json"), "utf8")
);

const usage = new Map();
for (const module of composition.modules) {
  for (const entry of [...module.primary, ...module.overlays, ...(module.supplemental ?? [])]) {
    if (!usage.has(entry.provider)) usage.set(entry.provider, new Set());
    usage.get(entry.provider).add(module.module);
  }
}

const json = process.argv.includes("--json");
const rows = [];
for (const provider of config.providers) {
  const record = await readProviderRecord(provider.id);
  const files = await listContentFiles(provider.id);
  rows.push({
    id: record.id,
    repository: record.repository,
    upstreamTag: record.upstreamTag,
    upstreamCommit: record.upstreamCommit,
    license: record.license,
    licenseEvidence: record.licenseEvidence,
    contentChecksum: record.contentChecksum,
    files: files.length,
    selectedPaths: record.selectedPaths,
    runtimeExecutables: record.runtimeExecutables,
    usedByModules: [...(usage.get(provider.id) ?? [])].sort()
  });
}

if (json) {
  console.log(JSON.stringify({ providers: rows }, null, 2));
} else {
  for (const row of rows) {
    console.log(`\n${row.id}  (${row.repository})`);
    console.log(
      `  pin        ${row.upstreamTag ?? "(no stable tag — default-branch head)"} @ ${row.upstreamCommit}`
    );
    console.log(`  licence    ${row.license}  [evidence: ${row.licenseEvidence}]`);
    console.log(`  checksum   ${row.contentChecksum}`);
    console.log(`  files      ${row.files}`);
    console.log(`  selection  ${row.selectedPaths.length} path pattern(s)`);
    console.log(`  executables ${row.runtimeExecutables.length}`);
    console.log(
      `  modules    ${row.usedByModules.length > 0 ? row.usedByModules.join(", ") : "(none)"}`
    );
  }
  console.log(
    `\n${rows.length} vendored providers. Update policy is reviewed-only for all of them.`
  );
}
