// Generates the standalone composition runtime shipped in every platform archive.
//
// The output is a transpiled import closure rooted at cli/src/composition-entry.ts. It therefore
// executes the same discovery and composition implementation as the npm CLI without duplicating
// that algorithm or shipping unrelated CLI commands.

import { readFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { assertNoSymlinkPath } from "./lib/fs-safety.mjs";
import { projectRoot } from "./project.mjs";

const sourceRoot = join(projectRoot, "cli", "src");
const entry = join(sourceRoot, "composition-entry.ts");
const runtimeRoot = join(projectRoot, ".fullstack-forge", "runtime");
const outputRoot = join(runtimeRoot, "cli", "src");
const queue = [entry];
const sources = new Set();

while (queue.length > 0) {
  const path = queue.pop();
  if (path === undefined || sources.has(path)) continue;
  assertInsideSource(path);
  const text = await readFile(path, "utf8");
  sources.add(path);
  const imports = ts.preProcessFile(text, true, true).importedFiles;
  for (const imported of imports) {
    if (!imported.fileName.startsWith(".")) continue;
    const resolved = await resolveLocalImport(path, imported.fileName);
    if (resolved !== undefined) queue.push(resolved);
  }
}

await assertNoSymlinkPath(projectRoot, runtimeRoot);
await rm(runtimeRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
await mkdir(outputRoot, { recursive: true });
for (const path of [...sources].sort()) {
  const source = await readFile(path, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true
    },
    fileName: path,
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  if (errors.length > 0)
    throw new Error(
      `${relative(projectRoot, path)} failed standalone transpilation: ${errors
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
        .join("; ")}`
    );
  const destination = join(outputRoot, relative(sourceRoot, path).replace(/\.ts$/u, ".js"));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, result.outputText, "utf8");
}
await writeFile(
  join(runtimeRoot, "cli", "package.json"),
  `${JSON.stringify({ type: "module", private: true }, null, 2)}\n`,
  "utf8"
);
await writeFile(
  join(runtimeRoot, "README.md"),
  [
    "# Fullstack Forge composition runtime",
    "",
    "Generated from the same TypeScript implementation used by the npm CLI. Host adapters invoke",
    "`cli/src/composition-entry.js`; it discovers repository evidence, resolves the selected and",
    "suppressed sources under the configured context budget, and writes `.forge/composition.json`.",
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  `Generated standalone composition runtime from ${sources.size} TypeScript source files.`
);

async function resolveLocalImport(importer, specifier) {
  const base = resolve(dirname(importer), specifier);
  const candidates =
    extname(base) === ".js"
      ? [base.replace(/\.js$/u, ".ts"), base.replace(/\.js$/u, ".tsx")]
      : [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  for (const candidate of candidates) {
    assertInsideSource(candidate);
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`${relative(projectRoot, importer)} imports missing local module '${specifier}'`);
}

function assertInsideSource(path) {
  const rel = relative(sourceRoot, path);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return;
  throw new Error(`Standalone composition import escapes cli/src: ${path}`);
}
