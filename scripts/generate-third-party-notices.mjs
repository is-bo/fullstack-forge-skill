// Generates THIRD_PARTY_NOTICES.md from the vendored-provider records, so attribution can never
// drift from what is actually shipped. Runs inside `npm run generate`; `git diff --exit-code`
// after generation is therefore a real check that the notices match the imports.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { listContentFiles, readProviderConfig, readProviderRecord } from "./lib/upstream.mjs";
import { projectRoot } from "./project.mjs";

const config = await readProviderConfig();
const rows = [];
for (const provider of config.providers) {
  const record = await readProviderRecord(provider.id);
  const files = await listContentFiles(provider.id);
  rows.push({ record, provider, fileCount: files.length });
}
const readmeOnly = rows
  .filter(({ record }) => record.licenseEvidence.includes("#"))
  .map(({ record }) => record.displayName);
const apacheProviders = rows
  .filter(({ record }) => record.license === "Apache-2.0")
  .map(({ record }) => record.displayName);

const sections = rows.map(({ record, provider, fileCount }) => {
  const tag =
    record.upstreamTag === null
      ? "_no stable release at import time; the reviewed default-branch head is pinned_"
      : `\`${record.upstreamTag}\``;
  const lines = [
    `### ${record.displayName}`,
    "",
    `- Source: https://github.com/${record.repository}`,
    `- Licence: **${record.license}** (read from \`${record.licenseEvidence}\`)`,
    `- Copyright: ${record.copyright ?? "_no explicit upstream copyright notice published_"}`,
    `- Imported release: ${tag}`,
    `- Imported commit: \`${record.upstreamCommit}\``,
    `- Files vendored: ${fileCount}`,
    `- Content checksum: \`${record.contentChecksum}\``,
    `- Update policy: ${record.updatePolicy}`,
    "",
    "Selected paths:",
    "",
    ...record.selectedPaths.map((path) => `- \`${path}\``),
    ""
  ];
  if (record.excludedPaths.length > 0) {
    lines.push("Excluded paths:", "", ...record.excludedPaths.map((p) => `- \`${p}\``), "");
  }
  if (record.runtimeExecutables.length > 0) {
    lines.push(
      `Declared runtime executables: ${record.runtimeExecutables.length}. These run only through` +
        " Forge's detector adapter, against local files, and never because a module was loaded.",
      ""
    );
  }
  if (provider.notes) lines.push(`Import notes: ${provider.notes}`, "");
  lines.push(
    "Local modifications: the pristine copy under `third_party/agent-skills/` is unmodified. The" +
      " copy Forge ships under `.fullstack-forge/upstream/` is generated from it by declared" +
      " transforms recorded in `.fullstack-forge/manifests/upstream-transforms.json`: upstream" +
      " skill files are renamed and their activation frontmatter is made inert, upstream command" +
      " names are rewritten to Forge routes, upstream installation instructions are removed, and" +
      " every external action remains subject to Forge approval. Evidenced upstream copyright and" +
      " NOTICE text is preserved unchanged.",
    ""
  );
  return lines.join("\n");
});

const document = `# Third-party notices

Fullstack Forge is original implementation work licensed under Apache-2.0. It **vendors** selected
open-source Agent Skills content from the projects listed below, and it **references** further
public standards and documentation for concepts only.

Every vendored import is pinned to an immutable commit, restricted to an explicit path allowlist,
checksummed, and reviewed. Nothing is fetched at runtime and nothing updates automatically. Inspect
the shipped \`.fullstack-forge/manifests/upstream-registry.json\` and the provider sections below to
see exactly what is installed.

The upstream maintainers do not endorse Fullstack Forge, and this project is not affiliated with
them.

Upstream licence terms are preserved verbatim in this repository under
\`third_party/agent-skills/<provider>/\`, and travel with the distributed package as
\`UPSTREAM-LICENSE\`, \`UPSTREAM-NOTICE\`, and \`UPSTREAM-SOURCE.md\` beside the content they
cover. ${readmeOnly.length === 1 ? `${readmeOnly[0]} publishes` : `${readmeOnly.join(", ")} publish`}
no LICENSE file at the pinned commit and ${readmeOnly.length === 1 ? "declares" : "declare"} the
licence only in \`README.md\`. The verbatim upstream declaration is recorded
**and** the canonical permission notice for the declared licence is supplied by Fullstack Forge and
paired with exact copyright evidence when upstream published any. The notice the licence requires
therefore travels with every copy. What upstream published and what Forge supplied are marked
separately in each file.

\`UPSTREAM-NOTICE\` is a Forge-generated provenance summary. Where a provider publishes its own
NOTICE file, exact bytes are shipped under \`UPSTREAM-NOTICES/\`.

## Vendored sources

${sections.join("\n")}
## Apache-2.0 NOTICE obligations

${apacheProviders.join(", ")} are Apache-2.0 imports. Their NOTICE content, where
upstream provides it, is preserved in each provider directory and redistributed with this package.
Forge does not alter upstream copyright notices, and the modifications listed above are made by
Forge's composition compiler at build time.

## Referenced for concepts only

The following were studied for concepts, interoperability, and audit coverage. No source code,
generated database, brand asset, or substantial prose from them is included in this distribution:
the Agent Skills specification repository (Apache-2.0 code, CC BY 4.0 documentation), Anthropic and
OpenAI skills, Neon Postgres and Auth0 agent skills, Redis agent skills, Microsoft Skills,
AccessLint, Expo Skills, and shadcn/ui.

Trail of Bits skills (CC BY-SA 4.0) and other share-alike licensed collections are deliberately
**not** vendored, and no protected text from them is adapted here.

The Agent Skills specification and platform names are owned by their respective projects and
vendors. This project is independent and is not endorsed by OpenAI, Anthropic, Google, Cursor,
Windsurf/Devin, GitHub, OWASP, NIST, W3C, or any referenced repository.

Exact URLs, revisions, access dates, scope, and licence handling for the researched sources appear
in \`research/SOURCES.md\` and \`research/LICENSE_MATRIX.md\`.

<!-- Generated by scripts/generate-third-party-notices.mjs. Edit that script, not this file. -->
`;

const target = join(projectRoot, "THIRD_PARTY_NOTICES.md");
let current = "";
try {
  current = await readFile(target, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (current !== document) await writeFile(target, document, "utf8");
console.log(`Recorded third-party notices for ${rows.length} vendored providers.`);
